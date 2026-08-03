// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import "../src/YinYang.sol";
import "../src/OthelloELO.sol";
import "../src/OthelloTreasury.sol";
import "../src/OthelloGame.sol";

contract DeployTest is Test {
    YinYang yyg;
    OthelloELO elo;
    OthelloTreasury treasury;
    OthelloGame game;

    function setUp() public {
        yyg = new YinYang();
        elo = new OthelloELO(address(this));
        treasury = new OthelloTreasury(address(yyg), address(elo), address(this));
        game = new OthelloGame(address(yyg), address(elo), address(treasury), address(this));

        elo.setGame(address(game));
        elo.setTreasury(address(treasury));
        treasury.setGame(address(game));
    }

    function test_DeployAllAndWire() public {
        //  Verify: all deployed
        assertTrue(address(yyg) != address(0));
        assertTrue(address(elo) != address(0));
        assertTrue(address(treasury) != address(0));
        assertTrue(address(game) != address(0));

        //  Verify: ELO wiring (public state vars)
        assertEq(elo.OthelloGame(), address(game), "elo.game == game");
        assertEq(elo.OthelloTreasury(), address(treasury), "elo.treasury == treasury");

        //  Verify: Treasury wiring
        assertEq(treasury.OthelloGame_Contract(), address(game), "treasury.game == game");

        //  Verify: Game initial state
        assertEq(game.nextGameId(), 0, "nextGameId == 0");

        //  Verify: ELO default
        assertEq(elo.getELO(makeAddr("anyone")), 1200e18, "default ELO == 1200e18");

        //  Verify: YYG token
        assertEq(yyg.name(), "YinYang", "YYG name");
        assertEq(yyg.symbol(), "YYG", "YYG symbol");
    }

    function test_EloOnlyAcceptsFromGame() public {
        // A random address calling recordResult should revert
        vm.prank(makeAddr("attacker"));
        vm.expectRevert(OthelloELO.UnauthorizedCaller.selector);
        elo.recordResult(makeAddr("winner"), makeAddr("loser"));
    }

    function test_TreasuryOnlyAcceptsFromGame() public {
        // A random address calling receive4Percent should revert
        vm.prank(makeAddr("attacker"));
        vm.expectRevert(OthelloTreasury.UnauthorizedCaller.selector);
        treasury.receive4Percent(100e18);
    }

    function test_SetGameRevertsForNonOwner() public {
        OthelloELO freshElo = new OthelloELO(address(this));
        vm.prank(makeAddr("attacker"));
        vm.expectRevert();
        freshElo.setGame(makeAddr("fakeGame"));
    }

    function test_SetTreasuryRevertsForNonOwner() public {
        OthelloELO freshElo = new OthelloELO(address(this));
        vm.prank(makeAddr("attacker"));
        vm.expectRevert();
        freshElo.setTreasury(makeAddr("fakeTreasury"));
    }

    function test_DeployScriptFunctionality() public {
        // End-to-end: wrap ETH, create game, verify the full wiring holds
        vm.deal(makeAddr("player1"), 10 ether);
        vm.startPrank(makeAddr("player1"));
        yyg.wrap{value: 1 ether}();
        yyg.approve(address(game), type(uint256).max);

        game.createGame(makeAddr("player2"), 100e18);
        vm.stopPrank();

        assertEq(game.nextGameId(), 1, "game created via wiring");

        // Verify game created, check nextGameId incremented
        assertEq(game.nextGameId(), 1, "game created via full wiring");
    }
}
