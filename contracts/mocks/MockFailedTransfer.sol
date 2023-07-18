// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockFailedTransfer is ERC20Burnable, Ownable {
    error DecentralizedHryvnaCoin__MustBeMoreThanZero();
    error DecentralizedHryvnaCoin__BurnAmountExceedsBalance();
    error DecentralizedHryvnaCoin__NotZeroAddress();

    constructor() ERC20("Decentralized Hryvna Coin", "DHC") {}

    function burn(uint256 _amount) public override onlyOwner {
        uint256 balance = balanceOf(msg.sender);
        if (_amount <= 0) {
            revert DecentralizedHryvnaCoin__MustBeMoreThanZero();
        }
        if (balance < _amount) {
            revert DecentralizedHryvnaCoin__BurnAmountExceedsBalance();
        }
        super.burn(_amount);
    }

    function mint(address _to, uint256 _amount) external onlyOwner returns (bool) {
        if (_to == address(0)) {
            revert DecentralizedHryvnaCoin__NotZeroAddress();
        }
        if (_amount <= 0) {
            revert DecentralizedHryvnaCoin__MustBeMoreThanZero();
        }
        _mint(_to, _amount);
        return true;
    }

    function transfer(
        address, /* _to */
        uint256 /* _amount */
    ) public pure override returns (bool) {
        return false;
    }
}
