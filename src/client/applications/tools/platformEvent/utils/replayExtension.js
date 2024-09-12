export class ReplayExtension{
    fetchReplayId;

    constructor(fetchReplayId){
        this.fetchReplayId = fetchReplayId;
    }

   

    incoming = function (message) {
        return message;
    }

    outgoing = function (message) {
        // Check if this is a subscribe message
        if (message.channel === '/meta/subscribe') {
            const subscription = message.subscription;
            // Attach replayId to the subscription if available
            message.ext = message.ext || {};
            message.ext['replay'] = {};
            message.ext['replay'][subscription] = this.fetchReplayId(subscription)//this.channelMap[subscription];
        }

        return message;
    }
};
