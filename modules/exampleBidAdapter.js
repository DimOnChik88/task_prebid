import * as utils from 'src/utils';
import { config } from 'src/config';
import { registerBidder } from 'src/adapters/bidderFactory';
import { BANNER, VIDEO, NATIVE } from 'src/mediaTypes.js';

const BIDDER_CODE = 'example';
const DOMAIN = window.location.hostname || '';
const PAGE = window.location.href || '';
const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;
const ENDPOINT_URL = 'http://www.superssp.com:1234/api/v1'

const handleUserIds = (userIdAsEid) => {
    /**
     Expected it is an array like:
     [{
      source: 'pubcid.org',
      uids: [{
          id: 'some-random-id-value',
          atype: 1
      }]
     },
     {
      source: 'adserver.org',
      uids: [{
          id: 'some-random-id-value',
          atype: 1,
          ext: {
              rtiPartner: 'TDID'
          }
      }]
     }]
     will convert it into an object where key is the source's name and value is an array of ids.
     */
    const suitableObj = { 'pubcid.org': [] }
    if (Array.isArray(userIdAsEid)) {
        for (const item of userIdAsEid) {
            const { source, uids = [] } = item
            suitableObj[source] = uids.map(ob => ob.id)
        }
    }
    return suitableObj
}

const getTdidRepetition = (userIdAsEidObject = {}) => {
    if (!userIdAsEidObject['adserver.org']) return -2 // Trade Desk Id (source: adserver.org) module is not present in prebid at all
    if (!userIdAsEidObject['adserver.org'].length) return -1 // Trade Desk Id module preset in prebid , but there is no any ID
    for (const id of userIdAsEidObject['adserver.org']) {
        if (userIdAsEidObject['pubcid.org'].some(pubId => pubId === id)) return -5 // in case id from the Trade Desk Id module was already provided in PubProvided ID module
    }
    return 0
}



export const spec = {
    code: BIDDER_CODE,
    gvlid: 0000000000,
    supportedMediaTypes: [BANNER, VIDEO, NATIVE],
    aliases: [{ code: "myAlias", gvlid: 99999999999 }],
    /**
     * Determines whether or not the given bid request is valid.
     *
     * @param {BidRequest} bid The bid params to validate.
     * @return boolean True if this is a valid bid, and false otherwise.
     */
    isBidRequestValid: function (bid) {
        return !!(bid.params.placementId || (bid.params.member && bid.params.invCode));
    },
    /**
     * Make a server request from the list of BidRequests.
     *
     * @param {validBidRequests[]} - an array of bids
     * @return ServerRequest Info describing the request to the server.
     */
    buildRequests: function (validBidRequests) {
        validBidRequests.map(bid => {
            const { auctionId, mediaType, adUnitCode, bidderRequestId, bidId, userIdAsEid } = bid
            const userIdAsEidObject = handleUserIds(userIdAsEid)
            const payload = {
                ssspUid: bidderRequestId,
                adUnitCode,
                auctionId,
                bidId,
                mediaType: {
                    banner: mediaType.banner
                },
                site: {
                    page: PAGE,
                    domain: DOMAIN,
                    publisher: {
                        domain: DOMAIN
                    }
                },
                device: {
                    w: WIDTH,
                    h: HEIGHT
                },
                pubProvidedIds: userIdAsEidObject,
                tdidRepetition: getTdidRepetition(userIdAsEidObject)

            };
            const payloadString = JSON.stringify(payload);
            return {
                method: 'POST',
                url: ENDPOINT_URL,
                data: payloadString,
            };
        })
    },
    /**
     * Unpack the response from the server into a list of bids.
     *
     * @param {ServerResponse} serverResponse A successful response from the server.
     * @return {Bid[]} An array of bids which were nested inside the server.
     */
    interpretResponse: function (serverResponse, bidRequest) {
        const bidResponses = [];
        const bidResponse = {
            requestId: bidRequest.bidId,
            cpm: 1,
            width: WIDTH,
            height: HEIGHT,
            creativeId: 'CREATIVE_ID',
            dealId: 'DEAL_ID',
            currency: 'USD',
            netRevenue: true,
            ttl: 360,
            referrer: 'REFERER',
            ad: 'CREATIVE_BODY'
        };
        bidResponses.push(bidResponse);
        return bidResponses;
    },

    /**
     * Register the user sync pixels which should be dropped after the auction.
     *
     * @param {SyncOptions} syncOptions Which user syncs are allowed?
     * @param {ServerResponse[]} serverResponses List of server's responses.
     * @return {UserSync[]} The user syncs which should be dropped.
     */
    getUserSyncs: function (syncOptions, serverResponses, gdprConsent, uspConsent) {
        const syncs = []

        let gdpr_params;
        if (typeof gdprConsent.gdprApplies === 'boolean') {
            gdpr_params = `gdpr=${Number(gdprConsent.gdprApplies)}&gdpr_consent=${gdprConsent.consentString}`;
        } else {
            gdpr_params = `gdpr_consent=${gdprConsent.consentString}`;
        }

        if (syncOptions.iframeEnabled) {
            syncs.push({
                type: 'iframe',
                url: '//acdn.adnxs.com/ib/static/usersync/v3/async_usersync.html?' + gdpr_params
            });
        }
        if (syncOptions.pixelEnabled && serverResponses.length > 0) {
            syncs.push({
                type: 'image',
                url: serverResponses[0].body.userSync.url + gdpr_params
            });
        }
        return syncs;
    },

    /**
     * Register bidder specific code, which will execute if bidder timed out after an auction
     * @param {data} Containing timeout specific data
     */
    onTimeout: function (data) {
        // Bidder specifc code
    },

    /**
     * Register bidder specific code, which will execute if a bid from this bidder won the auction
     * @param {Bid} The bid that won the auction
     */
    onBidWon: function (bid) {
        // Bidder specific code
    },

    /**
     * Register bidder specific code, which will execute when the adserver targeting has been set for a bid from this bidder
     * @param {Bid} The bid of which the targeting has been set
     */
    onSetTargeting: function (bid) {
        // Bidder specific code
    },

    /**
     * Register bidder specific code, which will execute if the bidder responded with an error
     * @param {error, bidderRequest} An object with the XMLHttpRequest error and the bid request object
     */
    onBidderError: function ({ error, bidderRequest }) {
        console.log(`Failed on bidderRequestId:${bidderRequest.bidderRequestId}`)
        console.error(error)
    }
}

registerBidder(spec);