import { writeToErrLog, writeToLog } from './utils/logging';

export { projPath } from './projPath';

export const logError = (msg: any): void => {
	writeToErrLog(msg);
};

export const logInfo = (msg: any): void => {
	writeToLog(msg);
};
