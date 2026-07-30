// The generic poller lives in `_shared` because both the OAuth and the API-key
// command groups poll task-shaped resources. `pollOpenAPI` stays as the name
// callers in this folder already use.
export {pollTask as pollOpenAPI, type PollConfig, type PollOptions} from '../_shared/polling.js';
