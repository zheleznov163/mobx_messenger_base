import Chat from "./Chat"
import Message from "../Message"
import { makeAutoObservable } from "mobx"

export default class ReactionsMenu {
	opened: Message | null = null

	constructor(public chat: Chat) {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	open(message: Message) {
		this.opened = message
	}

	close() {
		this.opened = null
	}
}
