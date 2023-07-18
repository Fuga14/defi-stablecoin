Design of protocol:
    1. (Relative stability) Anchored or Pegged -> $1.00
        1.1 Chainlink price feed
        1.2 Set a function to exchange ETH & BTC -> $$$
    2. Stability Mechanism (Minting): Algotithmic (Decentralized)
        2.1 People can only mint the stablecoing with enough callateral (coded)
    3. Collateral: Exogenous (Crypto)
        3.1 wETH (ERC20 version)
        3.2 wBTC (ERC20 version)


Layout of Contract:
version
imports
errors
interfaces, libraries, contracts
Type declarations
State variables
Events
Modifiers
Functions

Layout of Functions:
constructor
receive function (if exists)
fallback function (if exists)
external
public
internal
private
internal & private view & pure functions
external & public view & pure functions



❗Make transferOwnership to Engine

CEI: CHECK -> EFFECTS -> INTERACTIONS

⚠️Use more function get Health Factor 

Redeem tests:
❌If transfer fails
✅Redeem amount is zero 
✅Can redeem amount
❌Revert error if redeeming breaks health factor
❌Emit event when redeeming collateral


✅calculate health factor function
✅set health factor if debt is 0 (3:15:00)
⚠️added a bunch of view functions
⚠️change latestRoundData to staleCheckLatestRoundData



