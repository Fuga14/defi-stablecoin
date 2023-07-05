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
    error DHCEngine__HealthFactorisOK();
    error DHCEngine__HealthFactorIsNotImporved();

    //////////////////////
    // State variables
    //////////////////////
    DecentralizedHryvnaCoin private immutable i_dhc;

    uint256 private constant ADDITIONAL_FEED_PRECISION = 1e10;
    uint256 private constant FEED_PRECISION = 1e8;
    uint256 private constant PRECISION = 1e18;
    uint256 private constant LIQUIDATION_THRESHOLD = 50; // This means you need to be 200% over-collateralized
    uint256 private constant LIQUIDATION_PRECISION = 100;
    uint256 private constant MIN_HEALTH_FACTOR = 1e18;
    uint256 private constant LIQUIDATION_BONUS = 10;

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

    event CollateralRedeemed(
        address indexed redeemedFrom,
        address indexed redeemedTo,
        address indexed token,
        uint256 amount
    );

    //////////////////////
    // Modifiers
    //////////////////////
    modifier moreThanZero(uint256 amount) {
        if (amount == 0) {
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

    /**
     * @param tokenCollateralAddress The address of the token to deposit as collateral
     * @param amountCollateral The amount of collateral to deposit
     * @param amountDhcToMint: The amount of DHC to mint
     * @notice This function combines depositing collateral and minting DHC in 1 transaction
     */
    function depostitCollateralandMintDHC(
        address tokenCollateralAddress,
        uint256 amountCollateral,
        uint256 amountDhcToMint
    ) external {
        depositCollateral(tokenCollateralAddress, amountCollateral);
        mintDhc(amountDhcToMint);
    }

    /**
     * @param tokenCollateralAddress The address of the token to deposit as collateral
     * @param amountCollateral The amount of collateral to deposit
     */
    function depositCollateral(
        address tokenCollateralAddress,
        uint256 amountCollateral
    )
        public
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

    /**
     *
     * @param tokenCollateralAddress The address of the collateral token to be redeemed
     * @param amountCollateral The amount of collateral to be redeemed
     * @param amountDhcToBurn The amount of Dhc to be burned
     * @notice The function includes checking health factor after redeeming collaterals
     *
     * This function will withdraw your collateral and burn DHC in 1 tx
     */
    function reedemCollateralForDHC(
        address tokenCollateralAddress,
        uint256 amountCollateral,
        uint256 amountDhcToBurn
    ) external {
        burnDhc(amountDhcToBurn);
        reedemCollateral(tokenCollateralAddress, amountCollateral);
    }

    // health factor must be more than 1 after collateral pulled
    function reedemCollateral(
        address tokenCollateralAddress,
        uint256 amountCollateral
    ) public moreThanZero(amountCollateral) nonReentrant {
        _redeemCollateral(
            msg.sender,
            msg.sender,
            tokenCollateralAddress,
            amountCollateral
        );
        _revertIfHealthFactorIsBroken(msg.sender);
    }

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

    function burnDhc(uint256 amount) public moreThanZero(amount) nonReentrant {
        _burnDhc(amount, msg.sender, msg.sender);
        _revertIfHealthFactorIsBroken(msg.sender); // ❓❓❓❓
    }

    /**
     *
     * @param collateralToken The ERC20 token address to liquidate from the user
     * @param user The user who has broken health factor. Health factor should be below MIN_HEALTH_FACTOR
     * @param debtToCover The amount of DHC you want to burn to improve the users health factor
     * @notice You can partially liquidate a user
     * @notice You will get a liquidation bonus for taking the users funds
     */
    function liquidate(
        address collateralToken,
        address user,
        uint256 debtToCover
    ) external moreThanZero(debtToCover) nonReentrant {
        uint256 startingUserHealthFactor = _healthFactor(user);
        if (startingUserHealthFactor >= MIN_HEALTH_FACTOR) {
            revert DHCEngine__HealthFactorisOK();
        }
        /*
        We want to burn their DHC "debt"
        And take their collateral
        Bad user: $140 ETH, $100 DHC
        debtToCover = $100
        $100 DHC = ??? ETH
        */
        uint256 tokenAmountFromDebtCovered = getTokenAmountFromUsd(
            collateralToken,
            debtToCover
        );

        // In order to make interest of liquidation we want to make 10% bonus
        // So if liquidation is $100 of WETH we'll give $110
        // We should implement a feature to liquidate in event the protocol is insolvent
        // And sweep extra amounts into a treasury

        uint256 bonusCollateral = (tokenAmountFromDebtCovered *
            LIQUIDATION_BONUS) / LIQUIDATION_PRECISION;
        uint256 totalCollateralToReedem = tokenAmountFromDebtCovered +
            bonusCollateral;
        _redeemCollateral(
            user,
            msg.sender,
            collateralToken,
            totalCollateralToReedem
        );

        //Then we burning DHC
        _burnDhc(debtToCover, user, msg.sender);
        uint256 endingUserHealthFactor = _healthFactor(user);
        if (endingUserHealthFactor <= startingUserHealthFactor) {
            revert DHCEngine__HealthFactorIsNotImporved();
        }
        _revertIfHealthFactorIsBroken(msg.sender);
    }

    //////////////////////
    // Private and internal functions
    //////////////////////

    /**
     *
     * @dev Low-level internal function, do not call unless the function calling
     * it is checking for health factors being broken
     */
    function _burnDhc(
        uint256 amountToBurnDhc,
        address onBehalfOf,
        address dhcFrom
    ) private {
        s_DHCMinted[onBehalfOf] -= amountToBurnDhc;
        bool success = i_dhc.transferFrom(
            dhcFrom,
            address(this),
            amountToBurnDhc
        );
        if (!success) {
            revert DHCEngine__TransferFailed();
        }
        i_dhc.burn(amountToBurnDhc);
    }

    function _redeemCollateral(
        address from,
        address to,
        address tokenCollateralAddress,
        uint256 amountCollateral
    ) private {
        s_collateralDeposited[from][tokenCollateralAddress] -= amountCollateral;
        emit CollateralRedeemed(
            from,
            to,
            tokenCollateralAddress,
            amountCollateral
        );

        // check health factor for being more than 1
        bool success = IERC20(tokenCollateralAddress).transfer(
            to,
            amountCollateral
        );
        if (!success) {
            revert DHCEngine__TransferFailed();
        }
    }

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

    function getTokenAmountFromUsd(address token, uint256 usdAmountInWei)
        public
        view
        returns (uint256)
    {
        // usdAmountInWei / priceOfToken
        AggregatorV3Interface priceFeed = AggregatorV3Interface(
            s_priceFeeds[token]
        );
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return
            (usdAmountInWei * PRECISION) /
            (uint256(price) * ADDITIONAL_FEED_PRECISION);
    }

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

    function getHealthFactor(address user) public view returns (uint256) {
        uint256 userHealthFactor = _healthFactor(user);
        return userHealthFactor;
    }
}
