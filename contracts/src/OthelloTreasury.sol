// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Interfaces.sol";

contract OthelloTreasury is Ownable {
    error UnauthorizedCaller();
    error SeasonNotEnded();
    error NoTreasuryBalance();
    error TransferFailed();

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
        if(msg.sender != OthelloGame_Contract) revert UnauthorizedCaller();
	_;
    }

    function receive4Percent(uint256 amount) external onlyGame{
        if(!YYG_TOKEN.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
    }

    function settleSeason(address[3] calldata top3) external{
        if(block.timestamp < seasonDeadline) revert SeasonNotEnded();
        uint256 pot = YYG_TOKEN.balanceOf(address(this));
        if(pot == 0) revert NoTreasuryBalance();
        if(!YYG_TOKEN.transfer(top3[0], pot*50/100)) revert TransferFailed();
        if(!YYG_TOKEN.transfer(top3[1], pot*30/100)) revert TransferFailed();
        if(!YYG_TOKEN.transfer(top3[2], pot*20/100)) revert TransferFailed();

        OthelloELO_Contract.resetSeason();
        seasonDeadline = block.timestamp + SEASON_DURATION;
    }
}
