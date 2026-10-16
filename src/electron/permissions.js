/** @namespace Permissions */

export const registeredPermissions = {}
/** List of permissions that will be allowed by default for each newly installed plugin. derived from user settings. Safe permissions are added here by default */
export const allowedByDefault = []
/** List of permissions that will be denied by default for each newly installed plugin. derived from user settings. Severe risk permissions are added here by default */
export const deniedByDefault = []

/**
 * Enum for permission risk. User can define which permissions
 * plugin has access to.
 * @member SAFE No risk to user security or information. General information that can be scraped off any public service anyway
 * @member LOW Low risk permissions that should be considered as good practices to not leak unnecessary information
 * @member MEDIUM Medium risk permissions pose a sizeable threat or can be abused
 * @member SEVERE Permissions only for development or power users that fully understand the risks of exposing certain methods/information to plugins
 * @enum {number}
 * @memberof Permissions
 */
export const PERMISSION_RISK_TYPE = Object.freeze({
	SAFE:0,
	LOW:1,
	MEDIUM:2,
	SEVERE:3
})

export class Permission {
	id=""
	riskType=PERMISSION_RISK_TYPE.LOW

	constructor(id,riskType) {
		this.id=id
		this.riskType=riskType
		registeredPermissions[id]=this
	}
}

export class PermissionManager {
	constructor() {}
	 
}
