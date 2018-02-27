Buyer
https://rinkeby.etherscan.io/address/0x5873E7b7F909B4F76ce4B7B3338DB674F1aC3a02
https://live.blockcypher.com/btc-testnet/address/moKmaCPVt2cEGvm14SAjHE2qWHtMriW7w8/

Seller
https://rinkeby.etherscan.io/address/0xe0578e4fd431e57b38c7bcd72036629f803df515
https://live.blockcypher.com/btc-testnet/address/mkeEZN3BDHmcAeGTWPquq65QW5dHoxrgdU/


```
 _swap = { 
     hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
     key: 'password',
     coin1: 'ethereum',
     coin2: 'bitcoin',
     amount1: 0.22,
     amount2: 0.11,
     transaction1: '0x4CD464eD23c06Ad3196c12e333cF142cA11747A5',
     transaction2: '2N3upnrHJEqcXUAnS2H6L6zDnJBqmTqhHhG',
     buyerAddress1: '0x5873E7b7F909B4F76ce4B7B3338DB674F1aC3a02',
     buyerAddress2: 'moKmaCPVt2cEGvm14SAjHE2qWHtMriW7w8',
     buyerScript1: '',
     buyerScript2: '',
     sellerAddress1: '0xc70103eddcA6cDf02952365bFbcf9A4A76Cd2066',
     sellerAddress2: 'mkeEZN3BDHmcAeGTWPquq65QW5dHoxrgdU',
     sellerScript1: '',
     sellerScript2: '' 
 }
```


 ```

pragma solidity ^0.4.0;

contract HTLC {
    
    // CHANGE THESE VARIABLES
    uint public lockTime =  60 seconds;
    address public toAddress = 0x14723a09acff6d2a60dcdf7aa4aff308fddc160c;
    // @note: prepend hash with '0x'
    bytes32 public hash = 0x6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b;
    string public dataString = 'BTC_n2mRtTv6p11sd15tNGio7EtCxqnmzQkQkt_0.5';

    uint public startTime = now;
    address public fromAddress;
    string public key;
    uint public fromValue;
    
    function HTLC() 
        payable 
    {
        fromAddress = msg.sender;
        fromValue = msg.value;
    }

    modifier condition(bool _condition) {
        require(_condition);
        _;
    }
    
    function checkKey(string _key)
        payable
        condition ( sha256(_key) == hash )
        returns (string)
    {
        toAddress.transfer(fromValue);
        key = _key;
        return key;
    }
    
    function withdraw () 
        payable
        condition ( startTime + lockTime < now )
        returns (uint)
    {
        fromAddress.transfer(fromValue);
        return fromValue;
    }
    
}


 ```