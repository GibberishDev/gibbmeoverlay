/** @namespace EventManager*/

import { GibbLogger } from "./logger"

const LOGGER = new GibbLogger("EventManager")

export class EventManager{

	RegisteredEvents
	ActiveEventSubscribers={}

	constructor() {

	}

	registerEvent = (id)=>{

	}

	addEventSubscriber = (subscriber, events=[])=>{

	}

}