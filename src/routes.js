/**
 * HTTP endpoints for proxy server
 */

const express = require('express');
const { writeLog } = require('./activity-logger');
const router = express.Router();
const path = require('path');

const { getDefaultAd, adTimeoutMs } = require('./defaults');
const { isValidType } = require('./validators');

/**
 * @route:  $URL/
 * @method: GET
 * @desc: Display welcome page to notify that proxy server is live 
 * @param: None
 * @returns: Hello World text message
 * @access: PUBLIC
 */
router.get('/', 
    (req, res) => {
        const msg = "Hello World! If you see this message, that means the proxy server is working!"
        res.send(msg);
    }
);

/**
 * @route:  $URL/version
 * @method: GET
 * @desc: Display the current version of the proxy server
 * @param: None
 * @returns: Current version, shown as a text, from the version property outlined in package.json
 * @access: PUBLIC
 */
router.get('/version', 
    (req, res) => {
        const { version } = require('../package.json');
        res.send(version);
    }
);

/**
 * @route:  $URL/ledger
 * @method: GET
 * @desc: Display the current ledger log file
 * @param: None
 * @returns: Current ledger log file
 * @access: PUBLIC
 */
router.get('/ledger', 
    (req, res) => {
        res.sendFile(path.resolve("activity.log"));
    }   
);


/**
 * @route:  $URL/peers
 * @method: GET
 * @desc: Display the list of peers that are currently connected to this proxy's swarm
 * @param: None
 * @returns: Current peer list of ads
 * @access: PUBLIC
 */
router.get('/peers', 
    (req, res) => {
        const peerList = req.app.get('peers').getPeerList();
        res.send(peerList);
    }
);

/**
 * @route:  $URL/ad
 * @method: GET
 * @desc: Display welcome page
 * @param: None
 * @returns: A single ad file of type: .png, .jpeg or .jpg from either its backup folder or from a connected peer in the swarm
 * @access: PUBLIC
 */
router.get('/ad', 
    (req, res) => {

        const io = req.app.get('io');   // main socketio server instance
        
        const peers = req.app.get('peers'); // the peers

        // ask all peers for an ad
        io.emit('get-ad');

        const timeoutAd = new Promise((resolve, reject) => {
            setTimeout(reject, adTimeoutMs);
        });

        const peerAd = new Promise((resolve, reject) => {
            peers.once('give-ad', (peer, fName, stream) => {
                // test file name from peer
                const fType = isValidType(fName);
                
                // if fType is undefined (not valid image or asset) bad, else forward to client 
                if (!fType) {
                    reject();  
                } else {
                    const message = `peer ${peer.id} served ${fName}\n`;
                    let messages = writeLog(message);
                    if (messages.length > 0) {
                        io.emit('activity-log-msg', messages);
                    }

                    resolve(() => {
                        res.contentType(fName);
                        res.send(stream);
                    });
                } 
            });
        }); 

        // timeout or peer response wins
        Promise.race([timeoutAd, peerAd])
            .then(sendAd => sendAd())
            .catch(() => res.sendFile(getDefaultAd()));
    }
);

module.exports = router;