// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import "../src/YinYang.sol";

contract YinYangTest is Test {
    YinYang public yyg;

	function setUp() public {
		yyg = new YinYang();
	}

	function testWrap(uint256 bal) public {
		address alice = makeAddr("aiSlopIsBadForHealth");

		// Foundry fuzzer can gen upto 10^77, so we need to bound it
		// For bal=0, 0 YYG is minted but the require condition in wrap would fail this, so we set bal > 0
		vm.assume(bal > 0 && bal <= type(uint256).max / 100000);
		vm.deal(alice, bal);

		vm.prank(alice);
		yyg.wrap{value: bal}();
		assertEq(bal*100000, yyg.balanceOf(alice));
	}

	function testUnwrap(uint256 amt) public {
		address alice = makeAddr("aiSlopIsBadForHealth");

		// Foundry fuzzer can gen upto 10^77, so we need to bound it
		// For amt=0, 0 YYG is minted but the require condition in unwrap would fail this, so we set amt > 0
		vm.assume(amt > 0 && amt <= type(uint256).max / 100000);
		vm.deal(alice, amt);

		vm.startPrank(alice);
		yyg.wrap{value: amt}();

		// 100000 YYG = 1 sETH
		yyg.unwrap(amt*100000);
		vm.stopPrank();

		assertEq(alice.balance, amt);
	}

	function testInsufficientBalance(uint256 stealAmt) public {
		address alice = makeAddr("aiSlopIsBadForHealth");

		// We need to actually test stealing money, so stealAmt > 0
		vm.assume(stealAmt > 0);
		vm.deal(alice, 0);

		vm.startPrank(alice);

		// We expect a revert here
		vm.expectRevert();
		yyg.unwrap(stealAmt);
		vm.stopPrank();

		assertEq(alice.balance, 0);
	}
}
