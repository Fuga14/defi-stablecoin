# Decentralized Hryvna Coin ₴ 

Welcome to the exciting world of an innovative financial protocol - a decentralized version of Ukraine's national currency. This protocol turns the idea of traditional money upside down, providing unique opportunities and attractive prospects for its users.

At first glance, it is just a coin, but in fact, it is an ingenious combination of autonomy and decentralization. The absence of an owner makes the protocol completely independent and free from third-party interference.

Each coin of this unique cryptocurrency has a value of $1, making it a convenient and stable unit of exchange. However, what makes this protocol even more exciting is its minting mechanism. Users can create new coins using their loans. This is a great opportunity to not only earn extra income, but also maintain the stability of the protocol.

To purchase coins, users must provide collateral as weth or wbtc currency, which ensures the security and stability of the system. At the same time, they are also free to get rid of their coins by burning them to get their collateral back. This opens new horizons for asset utilization and ensures liquidity in the system.

Particular attention should be paid to the user elimination mechanism. The protocol actively monitors the health factor of users, and if their health factor drops below 1 due to changes in the exchange rate of their collateral assets, liquidation occurs. However, this is not just a punitive measure. Liquidation is accompanied by a 10% bonus that goes into the protocol's account as compensation for the risks. This serves as a motivation for all participants to be careful and responsible, which ensures the stability and reliability of the protocol.

In addition, users can send their coins to each other without any problems, making this protocol an ideal choice for fast and reliable money transfers.

In conclusion, this decentralized Ukrainian national currency protocol is a powerful tool for financial freedom and stability. It gives the user unique control over their assets and provides opportunities for prosperity and growth. Dare to explore this amazing world of financial opportunities and be a part of the decentralization revolution.


## Design of protocol:
    1. (Relative stability) Anchored or Pegged -> $1.00
        1.1 Chainlink price feed
        1.2 Set a function to exchange ETH & BTC -> $$$
    2. Stability Mechanism (Minting): Algotithmic (Decentralized)
        2.1 People can only mint the stablecoing with enough callateral (coded)
    3. Collateral: Exogenous (Crypto)
        3.1 wETH (ERC20 version)
        3.2 wBTC (ERC20 version)

## Install project 
```shell
npm install --force
```

## Run tests and see coverage 
```shell
npx hardhat coverage
```




