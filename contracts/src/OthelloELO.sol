// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "prb-math/SD59x18.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract OthelloELO is Ownable {
    error UnauthorizedCaller();
    error EloDiffTooLarge();

    mapping(uint256 currSeason => mapping(address player => uint256 eloPlayer)) public elo;
    uint256 public currSeason;
    address public OthelloGame;
    address public OthelloTreasury;

    event ELOUpdated(address indexed winner, uint256 newWinnerElo, address indexed loser, uint256 newLoserElo);

    constructor(address initialOwner) Ownable(initialOwner){
        currSeason = 0;
    }

    modifier onlyGame() {
        if(msg.sender != OthelloGame) revert UnauthorizedCaller();
	_;
    }

    modifier onlyGameOrTreasury() {
        if(msg.sender != OthelloGame && msg.sender != OthelloTreasury) revert UnauthorizedCaller();
        _;
    }

    function setGame(address game) external onlyOwner {
        OthelloGame = game;
    }

    function setTreasury(address t) external onlyOwner {
        OthelloTreasury = t;
    }

    function resetSeason() external onlyGameOrTreasury {
        unchecked { currSeason += 1; }
    }

    function getELO(address player) public returns (uint256){
        if(elo[currSeason][player] == 0) elo[currSeason][player] = uint256(1200 * 1e18);
        return elo[currSeason][player];
    }

    function _setEloForTest(uint256 season, address player, uint256 rating) external onlyOwner{
        elo[season][player] = rating;
    }

    /// @notice Calculation of ELO for Leaderboard.
    /// @dev Use of prb-math needed to tackle floating point based computation safely.
    /// Notes:
    /// - Formula for ELO calculation = 1/(1 + 10^((eloLoser - eloWinner)/400))
    /// - Figure out a way to make ELO calculation also detect players who cheat the system by using Bots (AI usage might be too hard)
    /// @param winner address of winner.
    /// @param loser address of loser.
    function recordResult(address winner, address loser) external onlyGame {
        int8 kfactor = 32;
        int256 eloWinner = int256(getELO(winner));
        int256 eloLoser = int256(getELO(loser));
        int256 diff = eloLoser - eloWinner;

        if(diff < -800e18 || diff > 800e18) revert EloDiffTooLarge();
        SD59x18 ELOdiff = sd(diff).div(sd(400e18));
        SD59x18 experimental = sd(10e18).pow(ELOdiff);
        SD59x18 expectedScore = sd(1e18).div(sd(1e18).add(experimental));
        uint256 change = uint256(SD59x18.unwrap(sd(kfactor).mul(sd(1e18).sub(expectedScore))));

        elo[currSeason][winner] += change;
        elo[currSeason][loser] -= change;

        emit ELOUpdated(winner, elo[currSeason][winner], loser, elo[currSeason][loser]);
    }
}
