// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract YinYang is ERC20, Ownable {
    constructor()
        ERC20("YinYang", "YYG")
        Ownable(msg.sender)
    {}

    receive() external payable {
        wrap();
    }

    function wrap() public payable {
        require(msg.value > 0, "give sepolia eth bro");
        _mint(msg.sender, msg.value*100000);
    }

    // Reentrancy guard
    uint256 private _locked = 1;
    modifier lock() {
        require(_locked == 1, "Reentrancy");
        _locked = 2;
        _;
        _locked = 1;
    }

    function unwrap(uint256 amount) public lock {
        require(amount > 0, "amount must be greater than 0");

        _burn(msg.sender, amount);
        (bool sent, ) = msg.sender.call{value: amount/100000}("");
        require(sent, "Failed to send Ether");
    }
}
