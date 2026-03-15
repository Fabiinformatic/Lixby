const { validateAdminArgs } = require('firebase-admin/data-connect');

const connectorConfig = {
  connector: 'example',
  serviceId: 'lixby',
  location: 'europe-central2'
};
exports.connectorConfig = connectorConfig;

function listPublicFutureVisions(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListPublicFutureVisions', undefined, inputOpts);
}
exports.listPublicFutureVisions = listPublicFutureVisions;

function createFutureVision(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateFutureVision', inputVars, inputOpts);
}
exports.createFutureVision = createFutureVision;

function myFutureCircles(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('MyFutureCircles', undefined, inputOpts);
}
exports.myFutureCircles = myFutureCircles;

function addCommentToFutureVision(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AddCommentToFutureVision', inputVars, inputOpts);
}
exports.addCommentToFutureVision = addCommentToFutureVision;

