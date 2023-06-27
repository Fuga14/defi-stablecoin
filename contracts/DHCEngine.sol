// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DecentralizedHryvnaCoin.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title DHCEngine
 * @author Vladyslav Pereder
 *
 * The system is designed to be as minimal as possible, and have the tokens maintain a 1 token == $1 peg at all times.
 * This is a stablecoin with the properties:
 * - Exogenously Collateralized
 * - Dollar Pegged
 * - Algorithmically Stable
 *
 * It is similar to DAI if DAI had no governance, no fees, and was backed by only WETH and WBTC.
 *
 * Our coin system should always be "collateralized". At no point, should value of collateralized <= the value of all coins
 *
 * @notice This contract is the core of the Decentralized Stablecoin system. It handles all the logic
 * for minting and redeeming DSC, as well as depositing and withdrawing collateral.
 * @notice This contract is based on the MakerDAO DSS system
 */
contract DHCEngine is ReentrancyGuard {
    //////////////////////
    // Errors
    //////////////////////
    error DHCEngine__NeedsMoreThanZero();
    error DHCEngine__TokenAddressesAndPriceFeedAddressesMustBeSameLength();
    error DHCEngine__NotAllowedToken();
    error DHCEngine__TransferFailed();
    error DHCEngine__MintFailed();
    error DHCEngine__BreaksHealthFactor(uint256 healthFactor);

    //////////////////////
    // State variables
    //////////////////////
    DecentralizedHryvnaCoin private immutable i_dhc;

    uint256 private constant ADDITIONAL_FEED_PRECISION = 1e10;
    uint256 private constant FEED_PRECISION = 1e8;
    uint256 private constant PRECISION = 1e18;
    uint256 private constant LIQUIDATION_THRESHOLD = 50; // This means you need to be 200% over-collateralized
    uint256 private constant LIQUIDATION_PRECISION = 100;
    uint256 private constant MIN_HEALTH_FACTOR = 1;

    /// @dev Mapping of token address to price feed address
    mapping(address => address) private s_priceFeeds;

    /// @dev Amount of collateral deposited by user
    mapping(address => mapping(address => uint256))
        private s_collateralDeposited;

    /// @dev Address of user to amount of minted tokens
    mapping(address => uint256) private s_DHCMinted;

    address[] private s_collaterTokens;

    //////////////////////
    // Events
    //////////////////////

    event CollateralDeposited(
        address indexed user,
        address indexed token,
        uint256 indexed amount
    );

    //////////////////////
    // Modifiers
    //////////////////////
    modifier moreThanZero(uint256 amount) {
        if (amount < 0) {
            revert DHCEngine__NeedsMoreThanZero();
        }
        _;
    }

    modifier isAllowedToken(address token) {
        if (s_priceFeeds[token] == address(0)) {
            revert DHCEngine__NotAllowedToken();
        }
        _;
    }

    //////////////////////
    // Functions
    //////////////////////
    constructor(
        address[] memory tokenAddresses,
        address[] memory priceFeedAddresses,
        address dhcAddress
    ) {
        if (tokenAddresses.length != priceFeedAddresses.length) {
            revert DHCEngine__TokenAddressesAndPriceFeedAddressesMustBeSameLength();
        }
        for (uint256 i = 0; i < tokenAddresses.length; i++) {
            s_priceFeeds[tokenAddresses[i]] = priceFeedAddresses[i];
            s_collaterTokens.push(tokenAddresses[i]);
        }
        i_dhc = DecentralizedHryvnaCoin(dhcAddress);
    }

    //////////////////////
    // External functions
    //////////////////////

    function depostitCollateralandMintDHC() external {}

    /**
     * @param tokenCollateralAddress The address of the token to deposit as collateral
     * @param amountCollateral The amount of collateral to deposit
     */
    function depositCollateral(
        address tokenCollateralAddress,
        uint256 amountCollateral
    )
        external
        moreThanZero(amountCollateral)
        isAllowedToken(tokenCollateralAddress)
        nonReentrant
    {
        s_collateralDeposited[msg.sender][
            tokenCollateralAddress
        ] += amountCollateral;
        emit CollateralDeposited(
            msg.sender,
            tokenCollateralAddress,
            amountCollateral
        );
        bool success = IERC20(tokenCollateralAddress).transferFrom(
            msg.sender,
            address(this),
            amountCollateral
        );
        if (!success) {
            revert DHCEngine__TransferFailed();
        }
    }

    function reedemCollateralForDHC() external {}

    function reedemCollateral() external {}

    /**
     *
     * @param amountDhcToMint: The amount of DHC to mint
     * @notice You can only mint if you have enough collateral
     * @notice They must have more collateral then the minimum treshold
     */
    function mintDhc(uint256 amountDhcToMint)
        public
        moreThanZero(amountDhcToMint)
        nonReentrant
    {
        s_DHCMinted[msg.sender] += amountDhcToMint;
        // if they minted too much ($150 DHC, $100 ETH)
        _revertIfHealthFactorIsBroken(msg.sender);
        bool minted = i_dhc.mint(msg.sender, amountDhcToMint);
        if (!minted) {
            revert DHCEngine__MintFailed();
        }
    }

    function burnDhc() external {}

    function liquidate() external {}

    function getHealthFactor() external view {}

    //////////////////////
    // Private and internal functions
    //////////////////////

    function _getAccountInformation(address user)
        internal
        view
        returns (uint256 totalDhcMinted, uint256 collateralValueInUsd)
    {
        totalDhcMinted = s_DHCMinted[user];
        collateralValueInUsd = getAccountCollateralValue(user);
    }

    function _healthFactor(address user) internal view returns (uint256) {
        // total DHC minted
        // total collateral VALUE
        (
            uint256 totalDhcMinted,
            uint256 collateralValueInUsd
        ) = _getAccountInformation(user);
        uint256 collateralAdjustedForThreshold = (collateralValueInUsd *
            LIQUIDATION_THRESHOLD) / LIQUIDATION_PRECISION;

        /*
        $1000 ETH - 100 DHC
        1000 * 50 = 50000 / 100 = (500 / 100) > 1 = not liquidated
        */

        return (collateralAdjustedForThreshold * PRECISION) / totalDhcMinted;
    }

    // 1. Check if the health factor have enough collateral
    // 2. Revert if the don't
    function _revertIfHealthFactorIsBroken(address user) internal view {
        uint256 userHealthFactor = _healthFactor(user);
        if (userHealthFactor < MIN_HEALTH_FACTOR) {
            revert DHCEngine__BreaksHealthFactor(userHealthFactor);
        }
    }

    //////////////////////
    // Public and exteranal view functions
    //////////////////////

    function getAccountCollateralValue(address user)
        public
        view
        returns (uint256 totalCollateralValueInUsd)
    {
        // loop through each collateral token, get the amount they have deposited, and map it to the price, to get the USD value
        for (uint256 i = 0; i < s_collaterTokens.length; i++) {
            address token = s_collaterTokens[i];
            uint256 amount = s_collateralDeposited[user][token];
            totalCollateralValueInUsd += getUsdValue(token, amount);
        }
        return totalCollateralValueInUsd;
    }

    function getUsdValue(address token, uint256 amount)
        public
        view
        returns (uint256)
    {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(
            s_priceFeeds[token]
        );
        (, int256 price, , , ) = priceFeed.latestRoundData();
        // 1 ETH - 1000$
        // price of 1 ETH * amount of collaterals in ETH / 1e18
        return
            ((uint256(price) * ADDITIONAL_FEED_PRECISION) * amount) / PRECISION;
    }
}
