// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import "../src/OthelloELO.sol";

contract OthelloELOTest is Test {
    OthelloELO public ELO;

    function setUp() public{
        ELO = new OthelloELO(address(this));

        // fake as onlyGame
        ELO.setGame(address(this));
    }

    function testInitialElo(address alice) public{
        assertEq(ELO.getELO(alice), 1200e18);
    }

    uint256 currSeason = 1;

    function testEloCalculationHelper(address winner, uint256 eloWinner, address loser, uint256 eloLoser) internal returns (uint256 initEloWinner, uint256 updatedELoWinner, uint256 initEloLoser, uint256 updatedEloLoser) {
        // max diff should be 800e18 as to not trigger the high diff require
        vm.assume(winner != loser);
        eloWinner = bound(eloWinner, 800e18, 1600e18);
        eloLoser = bound(eloLoser, 800e18, 1600e18);
        vm.assume(eloWinner > eloLoser);
        vm.assume(winner != loser);

        ELO._setEloForTest(ELO.currSeason(), winner, eloWinner);
        initEloWinner = eloWinner;
        ELO._setEloForTest(ELO.currSeason(), loser, eloLoser);
        initEloLoser = eloLoser;

        ELO.recordResult(winner, loser);

        updatedELoWinner = ELO.getELO(winner);
        updatedEloLoser = ELO.getELO(loser);
    }

    function testRecordResult(address winner, uint256 eloWinner, address loser, uint256 eloLoser) public{
        vm.assume(winner != loser);
        (uint256 initEloWinner, uint256 updatedELoWinner, uint256 initEloLoser, uint256 updatedEloLoser) = testEloCalculationHelper(winner, eloWinner, loser, eloLoser);

        assertTrue(updatedELoWinner >= initEloWinner, "winner must not lose ELO");
        assertTrue(updatedEloLoser <= initEloLoser, "loser must not gain ELO");
    }

    function testSymmetry(address winner, uint256 eloWinner, address loser, uint256 eloLoser) public{
        vm.assume(winner != loser);
        (uint256 initEloWinner, uint256 updatedELoWinner, uint256 initEloLoser, uint256 updatedEloLoser) = testEloCalculationHelper(winner, eloWinner, loser, eloLoser);

        assertEq(updatedELoWinner-initEloWinner, initEloLoser-updatedEloLoser);
    }

    function testSeasonReset(address winner, uint256 eloWinner, address loser, uint256 eloLoser) public{
        testEloCalculationHelper(winner, eloWinner, loser, eloLoser);

        ELO.resetSeason();
        assertEq(ELO.getELO(winner), 1200e18);
        assertEq(ELO.getELO(loser), 1200e18);
    }

    function testOnlyGame(address winner, uint256 eloWinner, address loser, uint256 eloLoser, address nonGame) public{
        // below is probably not even possible in a lifetime but who cares
        vm.assume(nonGame != address(this) && nonGame != address(ELO) && nonGame != address(0));
        ELO.setGame(nonGame);

        ELO._setEloForTest(ELO.currSeason(), winner, eloWinner);
        ELO._setEloForTest(ELO.currSeason(), loser, eloLoser);
        vm.expectRevert();
        ELO.recordResult(winner, loser);
    }

    function testDiffTooLarge(address winner, uint256 eloWinner, address loser, uint256 eloLoser) public {
        vm.assume(winner != loser);
        // bound first so no arithmetic in vm.assume can overflow;
        // eloLoser > 0 prevents getELO from re-initialising it to 1200e18
        eloWinner = bound(eloWinner, 2500e18, 5000e18);
        eloLoser = bound(eloLoser, 800e18, 1500e18);
        vm.assume(eloWinner > eloLoser + 800e18);

        ELO._setEloForTest(ELO.currSeason(), winner, eloWinner);
        ELO._setEloForTest(ELO.currSeason(), loser, eloLoser);
        vm.expectRevert();
        ELO.recordResult(winner, loser);
    }

    function testVerifyTopThreeCorrect() public {
        address[3] memory top3 = [address(0x1), address(0x2), address(0x3)];
        ELO._setEloForTest(ELO.currSeason(), top3[0], 1500e18);
        ELO._setEloForTest(ELO.currSeason(), top3[1], 1300e18);
        ELO._setEloForTest(ELO.currSeason(), top3[2], 1100e18);
        ELO.verifyTopThree(top3); // should not revert
    }

    function testVerifyTopThreeIncorrectOrder() public {
        address[3] memory top3 = [address(0x1), address(0x2), address(0x3)];
        ELO._setEloForTest(ELO.currSeason(), top3[0], 1100e18);
        ELO._setEloForTest(ELO.currSeason(), top3[1], 1300e18);
        ELO._setEloForTest(ELO.currSeason(), top3[2], 1500e18);
        vm.expectRevert(OthelloELO.InvalidTopThree.selector);
        ELO.verifyTopThree(top3);
    }

    function testVerifyTopThreeDuplicate() public {
        address[3] memory top3 = [address(0x1), address(0x1), address(0x3)];
        ELO._setEloForTest(ELO.currSeason(), top3[0], 1500e18);
        ELO._setEloForTest(ELO.currSeason(), top3[2], 1100e18);
        vm.expectRevert(OthelloELO.InvalidTopThree.selector);
        ELO.verifyTopThree(top3);
    }

    function testVerifyTopThreeZeroElo() public {
        address[3] memory top3 = [address(0x1), address(0x2), address(0x3)];
        ELO._setEloForTest(ELO.currSeason(), top3[0], 1500e18);
        ELO._setEloForTest(ELO.currSeason(), top3[1], 0);
        ELO._setEloForTest(ELO.currSeason(), top3[2], 1100e18);
        vm.expectRevert(OthelloELO.InvalidTopThree.selector);
        ELO.verifyTopThree(top3);
    }
}
