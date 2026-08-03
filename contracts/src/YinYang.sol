// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract YinYang is ERC20, Ownable {
    error ZeroWrap();
    error ZeroAmount();
    error ReentrancyGuard();
    error FailedSendEth();

    constructor()
        ERC20("YinYang", "YYG")
        Ownable(msg.sender)
    {}

    receive() external payable {
        wrap();
    }

    function wrap() public payable {
        if(msg.value == 0) revert ZeroWrap();
        _mint(msg.sender, msg.value*100000);
    }

    // Reentrancy guard
    uint256 private _locked = 1;
    modifier lock() {
        if(_locked != 1) revert ReentrancyGuard();
        _locked = 2;
        _;
        _locked = 1;
    }

    function unwrap(uint256 amount) public lock {
        if(amount == 0) revert ZeroAmount();

        _burn(msg.sender, amount);
        (bool sent, ) = msg.sender.call{value: amount/100000}("");
        if(!sent) revert FailedSendEth();
    }
}
