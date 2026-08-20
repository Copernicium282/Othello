// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import "../src/YinYang.sol";

contract YinYangTest is Test {
    YinYang public yyg;

    function setUp() public {
        yyg = new YinYang();
    }

    function testWrap(uint256 bal) public {
        address alice = makeAddr("aiSlopIsBadForHealth");

        // Foundry fuzzer can gen upto 10^77, so we need to bound it
        // For bal=0, 0 YYG is minted but the require condition in wrap would fail this, so we set bal > 0
        vm.assume(bal > 0 && bal <= type(uint256).max / 100000);
        vm.deal(alice, bal);

        vm.prank(alice);
        yyg.wrap{value: bal}();
        assertEq(bal * 100000, yyg.balanceOf(alice));
    }

    function testUnwrap(uint256 amt) public {
        address alice = makeAddr("aiSlopIsBadForHealth");

        // Foundry fuzzer can gen upto 10^77, so we need to bound it
        // For amt=0, 0 YYG is minted but the require condition in unwrap would fail this, so we set amt > 0
        vm.assume(amt > 0 && amt <= type(uint256).max / 100000);
        vm.deal(alice, amt);

        vm.startPrank(alice);
        yyg.wrap{value: amt}();

        // 100000 YYG = 1 sETH
        yyg.unwrap(amt * 100000);
        vm.stopPrank();

        assertEq(alice.balance, amt);
    }

    function testUnwrapDustReverts() public {
        address alice = makeAddr("aiSlopIsBadForHealth");

        vm.deal(alice, 1 ether);

        vm.startPrank(alice);
        yyg.wrap{value: 1 ether}();

        // 100001 YYG is not a multiple of the 100000 YYG-per-STT ratio -> dust
        vm.expectRevert(YinYang.DustAmount.selector);
        yyg.unwrap(100001);
        vm.stopPrank();
    }

    function testInsufficientBalance(uint256 stealAmt) public {
        address alice = makeAddr("aiSlopIsBadForHealth");

        // We need to actually test stealing money, so stealAmt > 0
        vm.assume(stealAmt > 0);
        vm.deal(alice, 0);

        vm.startPrank(alice);

        // We expect a revert here
        vm.expectRevert();
        yyg.unwrap(stealAmt);
        vm.stopPrank();

        assertEq(alice.balance, 0);
    }

    function testPermitSetsAllowance(uint256 value, uint256 deadline) public {
        uint256 pk = 0xA11CE;
        address owner = vm.addr(pk);
        address spender = makeAddr("game");
        // Any future deadline is valid; value is a full uint256 (permit is unbounded)
        deadline = bound(deadline, block.timestamp + 1, block.timestamp + 365 days);

        bytes32 typeHash =
            keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
        bytes32 structHash = keccak256(abi.encode(typeHash, owner, spender, value, yyg.nonces(owner), deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", yyg.DOMAIN_SEPARATOR(), structHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        yyg.permit(owner, spender, value, deadline, v, r, s);

        assertEq(yyg.allowance(owner, spender), value);
        assertEq(yyg.nonces(owner), 1, "nonce must increment");
    }

    function testPermitExpiredDeadlineReverts(uint256 deadline) public {
        uint256 pk = 0xA11CE;
        address owner = vm.addr(pk);
        address spender = makeAddr("game");
        deadline = bound(deadline, 0, block.timestamp - 1);

        bytes32 typeHash =
            keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
        bytes32 structHash = keccak256(abi.encode(typeHash, owner, spender, 100e18, yyg.nonces(owner), deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", yyg.DOMAIN_SEPARATOR(), structHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        vm.expectRevert();
        yyg.permit(owner, spender, 100e18, deadline, v, r, s);
    }
}
