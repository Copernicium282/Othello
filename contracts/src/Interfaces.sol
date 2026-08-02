// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface IOthelloELO {
	function setGame(address game) external;
	function resetSeason() external;
	function getELO(address player) external returns (uint256);
	function recordResult(address winner, address loser) external;
}

interface IOthelloTreasury {
	function setGame(address game) external;
	function receive4Percent(uint256 amount) external;
	function settleSeason(address[3] calldata top3) external;
}