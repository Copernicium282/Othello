// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import "../src/OthelloSessionDelegate.sol";

/// Minimal game double : records the call context a real OthelloGame would
/// see (msg.sender is the EOA thanks to 7702 delegatecall semantics).
contract MockGame {
    address public lastCaller;
    uint256 public lastGameId;
    uint8 public lastPosition;

    function makeMove(uint256 gameId, uint8 position) external {
        lastCaller = msg.sender;
        lastGameId = gameId;
        lastPosition = position;
    }
}

contract SessionDelegateTest is Test {
    OthelloSessionDelegate public delegate;
    MockGame public mockGame;
    address public eoa;
    address public sessionKey;
    address public stranger;

    function setUp() public {
        delegate = new OthelloSessionDelegate();
        mockGame = new MockGame();
        eoa = makeAddr("playerEoa");
        sessionKey = makeAddr("sessionKey");
        stranger = makeAddr("stranger");

        // Simulate EIP-7702 : the EOA's code becomes the delegate implementation
        vm.etch(eoa, address(delegate).code);
    }

    function _register(uint256 gameId, uint256 durationBlocks) internal {
        vm.prank(eoa);
        eoa.call(abi.encodeCall(delegate.registerSession, (address(mockGame), gameId, sessionKey, durationBlocks)));
    }

    /// 7702 storage lives on the EOA, so the session getter must be called
    /// through the EOA's code, not the delegate contract itself.
    function _session() internal returns (address, uint256, address, uint256, bool) {
        (bool ok, bytes memory data) = eoa.call(abi.encodeCall(delegate.session, ()));
        assertTrue(ok, "session read must succeed");
        return abi.decode(data, (address, uint256, address, uint256, bool));
    }

    function testRegisterAndExecuteMove(uint256 gameId, uint8 position, uint256 durationBlocks) public {
        // Any gameId/position work; keep expiry within roll-able range
        durationBlocks = bound(durationBlocks, 1, 1_000_000);
        _register(gameId, durationBlocks);

        (address game, uint256 registeredGameId, address key, uint256 expiry, bool active) = _session();
        assertEq(game, address(mockGame));
        assertEq(registeredGameId, gameId);
        assertEq(key, sessionKey);
        assertEq(expiry, block.number + durationBlocks);
        assertTrue(active);

        vm.prank(sessionKey);
        eoa.call(abi.encodeCall(delegate.executeMove, (position)));

        // The game must see the EOA, not the session key (delegatecall context)
        assertEq(mockGame.lastCaller(), eoa);
        assertEq(mockGame.lastGameId(), gameId);
        assertEq(mockGame.lastPosition(), position);
    }

    function testExecuteMoveWrongKeyReverts(uint8 position) public {
        _register(7, 1000);

        vm.prank(stranger);
        vm.expectRevert(OthelloSessionDelegate.NotSessionKey.selector);
        eoa.call(abi.encodeCall(delegate.executeMove, (position)));
    }

    function testExecuteMoveExpiredReverts(uint256 durationBlocks) public {
        durationBlocks = bound(durationBlocks, 1, 1_000_000);
        _register(7, durationBlocks);
        vm.roll(block.number + durationBlocks + 1);

        vm.prank(sessionKey);
        vm.expectRevert(OthelloSessionDelegate.SessionExpired.selector);
        eoa.call(abi.encodeCall(delegate.executeMove, (1)));
    }

    function testRevokeThenExecuteReverts(uint8 position) public {
        _register(7, 1000);

        vm.prank(eoa);
        eoa.call(abi.encodeCall(delegate.revokeSession, ()));

        vm.prank(sessionKey);
        vm.expectRevert(OthelloSessionDelegate.SessionNotActive.selector);
        eoa.call(abi.encodeCall(delegate.executeMove, (position)));
    }

    function testRegisterNotOwnerReverts(uint256 gameId, uint8 position) public {
        vm.prank(stranger);
        vm.expectRevert(OthelloSessionDelegate.NotOwner.selector);
        eoa.call(abi.encodeCall(delegate.registerSession, (address(mockGame), gameId, sessionKey, 1000)));

        // Stranger also can't move through the (never registered) session
        vm.prank(stranger);
        vm.expectRevert(OthelloSessionDelegate.NotSessionKey.selector);
        eoa.call(abi.encodeCall(delegate.executeMove, (position)));
    }

    function testRevokeNotOwnerReverts(uint8 position) public {
        _register(7, 1000);

        vm.prank(sessionKey);
        vm.expectRevert(OthelloSessionDelegate.NotOwner.selector);
        eoa.call(abi.encodeCall(delegate.revokeSession, ()));

        // Session still live for its key after failed revoke
        vm.prank(sessionKey);
        eoa.call(abi.encodeCall(delegate.executeMove, (position)));
        assertEq(mockGame.lastPosition(), position);
    }

    function testFreshEoaHasNoSession() public {
        (address game,, address key,, bool active) = _session();
        assertEq(game, address(0));
        assertEq(key, address(0));
        assertFalse(active);
    }
}
