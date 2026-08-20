// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import "../src/OthelloGame.sol"; // brings in OthelloGame + OthelloGameHarness
import "../src/OthelloELO.sol";
import "../src/OthelloTreasury.sol";
import "../src/YinYang.sol";
import "../src/Interfaces.sol";

/* NOTE: OthelloGameHarness (defined at the bottom of OthelloGame.sol) is the
   test harness, it inherits OthelloGame and re-exposes the internal _settle
   as `settle`, plus `seedBoard`/`seedStake`/`record` seeders/readers. We reuse
   it here instead of defining our own, so there is exactly one harness. */

contract OthelloGameTest is Test, OthelloGame(address(0), address(0), address(0), address(1)) {
    YinYang public yyg;
    OthelloELO public elo;
    OthelloTreasury public treasuryContract;
    OthelloGameHarness public harness;
    address alice = makeAddr("alice"); // owner of yyg + elo, and always Challenger
    address bob = makeAddr("bob"); // always Opponent

    function setUp() public {
        vm.deal(alice, 1000 ether);

        yyg = new YinYang();
        elo = new OthelloELO(alice); // alice = owner -> can call onlyOwner setters
        treasuryContract = new OthelloTreasury(address(yyg), address(elo), alice);
        harness = new OthelloGameHarness(address(yyg), address(elo), address(treasuryContract), alice);

        vm.startPrank(alice);
        elo.setGame(address(harness));
        elo.setTreasury(address(treasuryContract));
        treasuryContract.setGame(address(harness));
        vm.stopPrank();

        // Fund the harness: alice wraps 1 ETH, sends 1_000 YYG to harness for _settle payouts.
        vm.startPrank(alice);
        yyg.wrap{value: 1 ether}();
        bool check = yyg.transfer(address(harness), 1000e18);
        require(check, "Harness YYG funding failed");
        vm.stopPrank();

        // Harness must approve Treasury so receive4Percent (transferFrom) works in _settle.
        vm.prank(address(harness));
        yyg.approve(address(treasuryContract), type(uint256).max);
    }

    /// Helper: set both players' ELO (alice is owner, so she can call onlyOwner).
    function _setElo(uint256 season, address who, uint256 rating) internal {
        vm.prank(alice);
        elo._setEloForTest(season, who, rating);
    }

    function testIsOccupied() public pure {
        (uint64 black, uint64 white) = getInitBitboards();
        assertTrue(_isOccupied(black, 28));
        assertTrue(_isOccupied(black, 35));
        assertTrue(_isOccupied(white, 27));
        assertTrue(_isOccupied(white, 36));
    }

    function testGetFlips() public pure {
        (uint64 black, uint64 white) = getInitBitboards();
        // Black plays at 19: flips white at 27 (South)
        assertEq(_getFlips(black, white, 19), 0x0000000008000000);
        // Black plays at 26: flips white at 27 (West)
        assertEq(_getFlips(black, white, 26), 0x0000000008000000);
        // Black plays at 37: flips white at 36 (North)
        assertEq(_getFlips(black, white, 37), 0x0000001000000000);
        // Black plays at 44: flips white at 36 (Northwest)
        assertEq(_getFlips(black, white, 44), 0x0000001000000000);
    }

    // _settle payout tests (seed exact endboards, bypass makeMove)
    // Tiny boards are fine: _settle only reads popcount(black) vs popcount(white).
    // distinctOpponents is false on a fresh game -> recordResult is SKIPPED, so
    // ELO must NOT move. We assert that explicitly (locks in the gate).

    // DRAW, unequal stakes: each player gets 96% of their OWN stake back.
    function test_Settle_Draw_NeutralReturnByOwnStake() public {
        harness.seedBoard(0, 0x5, 0xA); // 2 vs 2 -> draw
        harness.seedStake(0, alice, 100e18, bob, 120e18);
        _setElo(0, alice, 1200e18);
        _setElo(0, bob, 1200e18);

        uint256 a0 = yyg.balanceOf(alice);
        uint256 b0 = yyg.balanceOf(bob);

        harness.settle(0);

        assertEq(yyg.balanceOf(alice), a0 + 100e18 * 96 / 100); // 96 YYG
        assertEq(yyg.balanceOf(bob), b0 + 120e18 * 96 / 100); // 115.2 YYG
        (,, Status st, address winner) = harness.record(0);
        assertTrue(st == Status.FINISHED, "game should be settled");
        assertEq(winner, address(0)); // draw -> no winner
        assertEq(elo.getELO(alice), 1200e18); // draw + gate off -> unchanged
        assertEq(elo.getELO(bob), 1200e18);
    }

    // RATED (|diff| < 400e18), black(alice) wins, unequal stakes:
    // winner takes 96% of the COMBINED pot; loser gets nothing.
    function test_Settle_RatedBlackWins_TakesCombinedPot() public {
        harness.seedBoard(0, 0x7, 0x8); // 3 black > 1 white -> black wins
        harness.seedStake(0, alice, 100e18, bob, 120e18); // combined = 220e18
        _setElo(0, alice, 1500e18);
        _setElo(0, bob, 1300e18); // diff 200e18 -> inside the +-400 band (rated)

        uint256 a0 = yyg.balanceOf(alice);
        uint256 b0 = yyg.balanceOf(bob);

        harness.settle(0);

        assertEq(yyg.balanceOf(alice), a0 + 220e18 * 96 / 100); // 211.2 YYG
        assertEq(yyg.balanceOf(bob), b0); // loser gets 0
        (,, Status st, address winner) = harness.record(0);
        assertTrue(st == Status.FINISHED, "game should be settled");
        assertEq(winner, alice); // black = Challenger = alice
        assertEq(elo.getELO(alice), 1500e18); // fresh game -> recordResult skipped
        assertEq(elo.getELO(bob), 1300e18);
    }

    // UNRATED (|diff| > 400e18), black wins on board: payout is NEUTRAL
    // (each gets 96% of own stake) even though recordResult would use the
    // true board winner here skipped because distinctOpponents is still off.
    function test_Settle_Unrated_NeutralPayout_EloGatedOff() public {
        harness.seedBoard(0, 0x7, 0x8); // black wins on board
        harness.seedStake(0, alice, 100e18, bob, 120e18);
        _setElo(0, alice, 2000e18);
        _setElo(0, bob, 1160e18); // diff 840e18 -> outside +-400 (unrated)

        uint256 a0 = yyg.balanceOf(alice);
        uint256 b0 = yyg.balanceOf(bob);

        harness.settle(0);

        // unrated pays neutral regardless of who won on the board:
        assertEq(yyg.balanceOf(alice), a0 + 100e18 * 96 / 100); // 96 YYG (own stake)
        assertEq(yyg.balanceOf(bob), b0 + 120e18 * 96 / 100); // 115.2 YYG (own stake)
        (,, Status st, address winner) = harness.record(0);
        assertTrue(st == Status.FINISHED, "game should be settled");
        assertEq(winner, alice); // board winner is still detected correctly
        assertEq(elo.getELO(alice), 2000e18); // gate still off -> ELO unchanged
        assertEq(elo.getELO(bob), 1160e18);
    }

    // 5.3C end-to-end: makeMove -> game-over detection -> _settle.
    // Artifical endgame: board has 62 black pieces + 1 white piece; bit 0 is empty
    // AND legal for black (it flanks white@bit1). One makeMove fills the board
    // (64 bits) -> makeMove's board-full check auto-calls _settle.
    // NOTE: this bypasses createGame/acceptGame, which are currently blocked by C5
    // (playerAddr stays address(0)). Tests the move->gameover->settle flow directly.
    function test_EndToEnd_MakeToSettle_FillsBoardAndSettles() public {
        uint64 black = 0xFFFFFFFFFFFFFFFC; // black on all squares except bit0 & bit1
        uint64 white = 0x2; // white owns only bit1
        harness.seedBoard(0, black, white); // sets ACTIVE + blackToMove = true
        harness.seedStake(0, alice, 100e18, bob, 120e18);
        _setElo(0, alice, 1200e18);
        _setElo(0, bob, 1200e18); // diff 0 -> inside +-400 band -> rated rules

        uint256 a0 = yyg.balanceOf(alice);
        uint256 b0 = yyg.balanceOf(bob);

        // black (alice, Challenger) plays pos 0: flips white@1, board fills -> _settle fires
        vm.prank(alice);
        harness.makeMove(0, 0);

        (,, Status st, address winner) = harness.record(0);
        assertTrue(st == Status.FINISHED, "makeMove should auto-settle on board-full");
        assertEq(winner, alice, "black/Challenger wins the board");

        // Rated black-win: winner takes 96% of the COMBINED pot; loser gets 0.
        uint256 combined = 100e18 + 120e18;
        assertEq(yyg.balanceOf(alice), a0 + combined * 96 / 100, "winner takes 96% of pot");
        assertEq(yyg.balanceOf(bob), b0, "loser gets nothing");
        // distinctOpponents is false on a fresh game -> recordResult is skipped -> ELO unchanged
        assertEq(elo.getELO(alice), 1200e18, "ELO gate should suppress recordResult");
    }

    // Full game lifecycle: createGame → acceptGame → makeMove → _settle
    // Tests the complete public-API flow. Uses seedBoard to jump to a near-end
    // position for settlement, but createGame/acceptGame/makeMove are real.
    function test_5_4_FullGameLifecycle() public {
        // Fund both players and approve harness for YYG transfers
        vm.startPrank(alice);
        yyg.wrap{value: 2 ether}();
        yyg.approve(address(harness), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(bob);
        vm.deal(bob, 10 ether);
        yyg.wrap{value: 2 ether}();
        yyg.approve(address(harness), type(uint256).max);
        vm.stopPrank();

        _setElo(0, alice, 1200e18);
        _setElo(0, bob, 1200e18);

        uint256 a0 = yyg.balanceOf(alice);
        uint256 b0 = yyg.balanceOf(bob);

        // Step 1: Alice creates game (challenger = black, stake 100 YYG)
        vm.prank(alice);
        harness.createGame(bob, 100e18);

        assertEq(yyg.balanceOf(alice), a0 - 100e18, "alice stake transferred on create");
        assertEq(harness.nextGameId(), 1, "gameId incremented after create");

        // Step 2: Bob accepts game (opponent = white, stake 100 YYG)
        // This implicitly verifies C5: p2.playerAddr == bob (onlyOpponent modifier)
        vm.prank(bob);
        harness.acceptGame(0, 100e18);

        assertEq(yyg.balanceOf(bob), b0 - 100e18, "bob stake transferred on accept");
        (,, Status st,) = harness.record(0);
        assertTrue(st == Status.ACTIVE, "game is ACTIVE after accept");

        // Verify initial board was set by acceptGame
        (uint64 bb, uint64 wb,,) = harness.record(0);
        assertEq(bb, uint64(0x0000000810000000), "initial black bits after accept");
        assertEq(wb, uint64(0x0000001008000000), "initial white bits after accept");

        // Step 3: Alice (black) plays position 19, flips white at 27
        vm.prank(alice);
        harness.makeMove(0, 19);

        (uint64 bb2, uint64 wb2,,) = harness.record(0);
        assertEq(bb2, uint64(0x0000000818080000), "black after move 19: {19,27,28,35}");
        assertEq(wb2, uint64(0x0000001000000000), "white after move 19: {36}");

        // Step 4: Seed near-end position → play final move → auto-settle
        // Board: 62 black + 1 white, bit0 empty and legal for black
        harness.seedBoard(0, 0xFFFFFFFFFFFFFFFC, 0x2);
        harness.seedStake(0, alice, 100e18, bob, 100e18);

        uint256 a1 = yyg.balanceOf(alice);
        uint256 b1 = yyg.balanceOf(bob);

        // Alice (black) plays pos 0 → flips white@1 → board full → _settle fires
        vm.prank(alice);
        harness.makeMove(0, 0);

        (,, Status st2, address winner) = harness.record(0);
        assertTrue(st2 == Status.FINISHED, "game FINISHED after board full");

        // Rated (diff=0 inside ±400), black wins: winner takes 96% of combined
        uint256 combined = 200e18;
        assertEq(yyg.balanceOf(alice), a1 + combined * 96 / 100, "winner 96% of combined pot");
        assertEq(yyg.balanceOf(bob), b1, "loser gets nothing");
        assertEq(winner, alice, "black/Challenger is the winner");
    }

    /// Helper: fund `who` with wrapped YYG and approve the harness to spend it.
    function _fundAndApprove(address who) internal {
        vm.startPrank(who);
        vm.deal(who, 2 ether);
        yyg.wrap{value: 2 ether}();
        yyg.approve(address(harness), type(uint256).max);
        vm.stopPrank();
    }

    // #3: acceptGame must reject stakes below MIN_STAKE before transferFrom.
    function test_AcceptGame_BelowMinStake_Reverts() public {
        vm.startPrank(alice);
        yyg.approve(address(harness), type(uint256).max);
        vm.stopPrank();

        vm.prank(alice);
        harness.createGame(bob, 100e18);

        vm.prank(bob);
        vm.expectRevert(OthelloGame.MinimumStake.selector);
        harness.acceptGame(0, 0);
    }

    // #4: MIN_STAKE is 10 YYG, not 10 wei.
    function test_CreateGame_BelowMinStake_Reverts() public {
        vm.startPrank(alice);
        yyg.approve(address(harness), type(uint256).max);
        vm.stopPrank();

        vm.prank(alice);
        vm.expectRevert(OthelloGame.MinimumStake.selector);
        harness.createGame(bob, 11);
    }

    // #17: a player must not be able to challenge themselves.
    function test_CreateGame_SelfOpponent_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(OthelloGame.InvalidOpponent.selector);
        harness.createGame(alice, 100e18);
    }

    // #5: the challenger's daily cap must also be enforced at accept time.
    // A challenger creates 21 games vs distinct opponents; the 21st accept
    // (which would push the challenger's dailyCount past DAILY_CAP) must revert.
    function test_AcceptGame_ChallengerDailyCapEnforcedAtAccept() public {
        vm.startPrank(alice);
        yyg.approve(address(harness), type(uint256).max);
        vm.stopPrank();

        address[21] memory opponents;
        for (uint256 i = 0; i < 21; i++) {
            opponents[i] = makeAddr(string.concat("opp", vm.toString(i)));
            _fundAndApprove(opponents[i]);
        }

        for (uint256 i = 0; i < 21; i++) {
            vm.prank(alice);
            harness.createGame(opponents[i], 100e18);
        }

        for (uint256 i = 0; i < 20; i++) {
            vm.prank(opponents[i]);
            harness.acceptGame(i, 100e18);
        }

        vm.prank(opponents[20]);
        vm.expectRevert(abi.encodeWithSelector(OthelloGame.Exceeded_Daily_Cap.selector, 0));
        harness.acceptGame(20, 100e18);
    }

    // #6: abandoned ACTIVE games can be resolved after the timeout — both
    // players get 96% of their own stake back and the treasury gets the 4% fee.
    function test_ResolveTimeout_PaysBothPlayersAndTreasury() public {
        harness.seedBoard(0, 0x5, 0xA); // 2 vs 2; payout is draw-style regardless
        harness.seedStake(0, alice, 100e18, bob, 120e18);
        vm.warp(block.timestamp + 25 hours);

        uint256 a0 = yyg.balanceOf(alice);
        uint256 b0 = yyg.balanceOf(bob);
        uint256 t0 = yyg.balanceOf(address(treasuryContract));

        harness.resolveTimeout(0);

        assertEq(yyg.balanceOf(alice), a0 + 100e18 * 96 / 100, "challenger refunded 96%");
        assertEq(yyg.balanceOf(bob), b0 + 120e18 * 96 / 100, "opponent refunded 96%");
        assertEq(yyg.balanceOf(address(treasuryContract)), t0 + 220e18 * 4 / 100, "treasury got 4%");
        (,, Status st,) = harness.record(0);
        assertTrue(st == Status.FINISHED, "game FINISHED after timeout resolution");
    }

    function test_ResolveTimeout_TooEarly_Reverts() public {
        harness.seedBoard(0, 0x5, 0xA);
        harness.seedStake(0, alice, 100e18, bob, 120e18);
        vm.warp(block.timestamp + 23 hours);

        vm.expectRevert(OthelloGame.TimeoutNotReached.selector);
        harness.resolveTimeout(0);
    }

    // #2: extreme ELO gaps (|diff| > 800e18) must NOT brick _settle. Previously
    // recordResult reverted EloDiffTooLarge, rolling back payouts and stranding
    // stakes forever with status ACTIVE. Now the ELO recording is skipped but the
    // neutral payout still goes through.
    function test_Settle_ExtremeEloDiff_PaysOutNeutrally() public {
        harness.seedBoard(0, 0x7, 0x8); // 3 black > 1 white -> black wins on board
        harness.seedStake(0, alice, 100e18, bob, 120e18);
        _setElo(0, alice, 2500e18);
        _setElo(0, bob, 1200e18); // diff 1300e18 -> recordResult would revert

        // Seed 3 distinct opponents for both players so the recordResult gate fires.
        address[3] memory aliceOpponents = [makeAddr("ao1"), makeAddr("ao2"), makeAddr("ao3")];
        address[3] memory bobOpponents = [makeAddr("bo1"), makeAddr("bo2"), makeAddr("bo3")];
        harness.seedHistory(alice, aliceOpponents);
        harness.seedHistory(bob, bobOpponents);

        uint256 a0 = yyg.balanceOf(alice);
        uint256 b0 = yyg.balanceOf(bob);
        uint256 t0 = yyg.balanceOf(address(treasuryContract));

        harness.settle(0); // must not revert

        assertEq(yyg.balanceOf(alice), a0 + 100e18 * 96 / 100, "challenger paid 96% of own stake");
        assertEq(yyg.balanceOf(bob), b0 + 120e18 * 96 / 100, "opponent paid 96% of own stake");
        assertEq(yyg.balanceOf(address(treasuryContract)), t0 + 220e18 * 4 / 100, "treasury got 4%");
        (,, Status st,) = harness.record(0);
        assertTrue(st == Status.FINISHED, "game should be settled, not bricked");
        assertEq(elo.getELO(alice), 2500e18, "ELO skipped for extreme diff");
        assertEq(elo.getELO(bob), 1200e18);
    }
}
