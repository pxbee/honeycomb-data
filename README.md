# tulip-data

This is a collection of utilities to query data of xdai and other networks

## Supported Queries

The below all return a Promise that resolves with the requested results.

1. `tulipData.tokenBalance({user_address})` Gets token balances of all tokens listed on honeyswap.
2. `tulipData.poolBalance({user_address})` Gets lp balance and information of honeyswap lps.

## Example

```javascript
const tulipData = require('tulip-data'); // common js
// or
import tulipData from 'tulip-data'; // es modules

// query and log resolved results
tulipData.tokenBalance
  .then(pools => console.log(pools))
```
