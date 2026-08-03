// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../src/YinYang.sol";
import "../src/OthelloELO.sol";
import "../src/OthelloTreasury.sol";
import "../src/OthelloGame.sol";

contract DeployScript is Script {
    function run() public {
        vm.startBroadcast();

        YinYang yyg = new YinYang();
        console2.log("YinYang deployed at:", address(yyg));

        OthelloELO elo = new OthelloELO(msg.sender);
        console2.log("OthelloELO deployed at:", address(elo));

        OthelloTreasury treasury = new OthelloTreasury(address(yyg), address(elo), msg.sender);
        console2.log("OthelloTreasury deployed at:", address(treasury));

        OthelloGame game = new OthelloGame(address(yyg), address(elo), address(treasury), msg.sender);
        console2.log("OthelloGame deployed at:", address(game));

        elo.setGame(address(game));
        elo.setTreasury(address(treasury));
        treasury.setGame(address(game));
        game.approveTreasury();

        console2.log("Wiring complete:");
        console2.log("  elo.game =>", address(game));
        console2.log("  elo.treasury =>", address(treasury));
        console2.log("  treasury.game =>", address(game));

        vm.stopBroadcast();
    }
}