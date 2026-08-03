// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import "../src/OthelloTreasury.sol";
import "../src/OthelloELO.sol";
import "../src/YinYang.sol";

contract OthelloTreasuryTest is Test {
    YinYang public yyg;
    OthelloELO public elo;
    OthelloTreasury public treasury;

    address owner = makeAddr("owner");
    address gameAddr = makeAddr("game");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    function setUp() public {
        yyg = new YinYang();
        elo = new OthelloELO(owner);
        treasury = new OthelloTreasury(address(yyg), address(elo), owner);

        vm.prank(owner);
        elo.setTreasury(address(treasury));

        vm.deal(owner, 10 ether);

        vm.startPrank(owner);
        treasury.setGame(gameAddr);
        yyg.wrap{value: 10 ether}();
        bool check = yyg.transfer(address(treasury), 1000e18);
        require(check, "Setup YYG transfer failed");
        vm.stopPrank();
    }

    // receive4Percent

    function testReceive4Percent_NonGameReverts() public {
        vm.prank(alice);
        vm.expectRevert(OthelloTreasury.UnauthorizedCaller.selector);
        treasury.receive4Percent(100e18);
    }

    function testReceive4Percent_GameCanCall() public {
        // Game address must have approved Treasury to spend YYG via transferFrom
        // In setUp, owner funded treasury with 1000e18, here we test the pull mechanic
        // by having the gameAddr hold and approve YYG.
        vm.deal(gameAddr, 10 ether);
        vm.startPrank(gameAddr);
        yyg.wrap{value: 10 ether}();
        yyg.approve(address(treasury), type(uint256).max);
        vm.stopPrank();

        uint256 gameBal1 = yyg.balanceOf(gameAddr);
        uint256 treasuryBal0 = yyg.balanceOf(address(treasury));
        vm.prank(gameAddr);
        treasury.receive4Percent(100e18);
        assertEq(yyg.balanceOf(address(treasury)), treasuryBal0 + 100e18, "treasury received 4%");
        assertEq(yyg.balanceOf(gameAddr), gameBal1 - 100e18, "game lost 100e18");
    }

    // setGame

    function testSetGame_OnlyOwnerCanCall() public {
        vm.prank(alice);
        vm.expectRevert();
        treasury.setGame(alice);
    }

    function testSetGame_OwnerCanUpdate() public {
        vm.prank(owner);
        treasury.setGame(alice);
        // No getter for OthelloGame_Contract exposed, but if it didn't revert, it worked.
    }

    // settleSeason

    function testSettleBeforeDeadlineReverts() public {
        // Deploy a fresh treasury to test from deployment time
        OthelloTreasury freshTreasury = new OthelloTreasury(address(yyg), address(elo), owner);
        vm.prank(owner);
        freshTreasury.setGame(gameAddr);
        vm.prank(owner);
        elo.setTreasury(address(freshTreasury));

        // Warp to only 1 day, deadline is 30 days from deploy
        vm.warp(block.timestamp + 1 days);

        address[3] memory top3 = [alice, bob, carol];
        vm.expectRevert(OthelloTreasury.SeasonNotEnded.selector);
        freshTreasury.settleSeason(top3);
    }

    function testSettleDistributesPot() public {
        uint256 totalBal = yyg.balanceOf(address(treasury)); // 1000e18 from setUp

        uint256 a0 = yyg.balanceOf(alice);
        uint256 b0 = yyg.balanceOf(bob);
        uint256 c0 = yyg.balanceOf(carol);

        // Warp past 30-day deadline
        vm.warp(block.timestamp + 30 days);

        address[3] memory top3 = [alice, bob, carol];
        treasury.settleSeason(top3);

        // 50% to alice, 30% to bob, 20% to carol
        assertEq(yyg.balanceOf(alice), a0 + totalBal * 50 / 100, "alice gets 50%");
        assertEq(yyg.balanceOf(bob), b0 + totalBal * 30 / 100, "bob gets 30%");
        assertEq(yyg.balanceOf(carol), c0 + totalBal * 20 / 100, "carol gets 20%");
        assertEq(yyg.balanceOf(address(treasury)), 0, "treasury empty after settle");
    }

    function testSettleResetsElo() public {
        // Set some non-default ELO to prove the season changed
        vm.prank(owner);
        elo._setEloForTest(0, alice, 1500e18);
        assertEq(elo.getELO(alice), 1500e18, "pre-settle ELO is 1500");

        vm.warp(block.timestamp + 30 days);

        address[3] memory top3 = [alice, bob, carol];
        treasury.settleSeason(top3);

        // After resetSeason, season increments to 1; alice's ELO in season 1 is uninitialized -> 1200e18
        assertEq(elo.getELO(alice), 1200e18, "post-settle ELO resets to 1200 default");
    }

    function testSettleWithZeroBalanceReverts() public {
        // Deploy empty treasury
        OthelloTreasury emptyTreasury = new OthelloTreasury(address(yyg), address(elo), owner);
        vm.prank(owner);
        emptyTreasury.setGame(gameAddr);
        vm.prank(owner);
        elo.setTreasury(address(emptyTreasury));

        vm.warp(block.timestamp + 30 days);

        address[3] memory top3 = [alice, bob, carol];
        vm.expectRevert(OthelloTreasury.NoTreasuryBalance.selector);
        emptyTreasury.settleSeason(top3);
    }
}
