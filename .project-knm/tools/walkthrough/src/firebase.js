// knm-managed: v1 version: 1
// Feedback is off in the bundled walkthrough: no sign-in, no network, nothing is sent anywhere. The same exports as the original
// engine so the rest of the code is unchanged.
export const setAppName = () => {};
export const ADMIN_EMAIL = '';
export const watchUser = (cb) => { cb(null); return () => {}; };
export const signInWithGoogle = async () => { throw new Error('Feedback is off in this walkthrough'); };
export const signOutUser = async () => {};
export const isAdmin = () => false;
export async function addFeedback() { throw new Error('Feedback is off in this walkthrough'); }
export const editFeedback = addFeedback;
export const setStatus = addFeedback;
export const deleteFeedback = addFeedback;
export const watchFeedback = () => () => {};
