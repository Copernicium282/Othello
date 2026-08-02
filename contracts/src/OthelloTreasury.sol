// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Interfaces.sol";

contract OthelloTreasury is Ownable {
    IERC20 immutable YYG_TOKEN;
    IOthelloELO immutable OthelloELO_Contract;
    address public OthelloGame_Contract;
    uint256 public seasonDeadline;
    uint256 constant SEASON_DURATION = 30 days;

    constructor(address yyg, address elo, address initialOwner) Ownable(initialOwner){
        seasonDeadline = block.timestamp + 30 days;
        YYG_TOKEN = IERC20(yyg);
        OthelloELO_Contract = IOthelloELO(elo);
    }

    function setGame(address game) external onlyOwner {
        OthelloGame_Contract = game;
    }

    modifier onlyGame() {
        require(msg.sender == OthelloGame_Contract, "Invalid Game Contract");
	_;
    }

    function receive4Percent(uint256 amount) external onlyGame{
        bool check = YYG_TOKEN.transferFrom(msg.sender, address(this), amount);
        require(check, "Failed to recieve 4% stake from Game");
    }

    function settleSeason(address[3] calldata top3) external{
        require(block.timestamp >= seasonDeadline, "Season not ended");
        uint256 pot = YYG_TOKEN.balanceOf(address(this));
        require(pot > 0, "No treasury balance");
        bool check = YYG_TOKEN.transfer(top3[0], pot*50/100);
        require(check, "Failed to send reward to TOP1");
        check = YYG_TOKEN.transfer(top3[1], pot*30/100);
        require(check, "Failed to send reward to TOP2");
        check = YYG_TOKEN.transfer(top3[2], pot*20/100);
        require(check, "Failed to send reward to TOP3");

        OthelloELO_Contract.resetSeason();
        seasonDeadline = block.timestamp + SEASON_DURATION;
    }
}
