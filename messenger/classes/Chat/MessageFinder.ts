import moment from "moment"
import { makeAutoObservable } from "mobx"
import ChatMessages from "./ChatMessages"
import { MessageLink } from "./MessagesChain"
import { IMessage } from "../Message"

export default class FindMessageController {
	link: MessageLink | null = null

	constructor(private messages: ChatMessages) {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	set(link: MessageLink) {
		this.link = link
		return link
	}

	remove() {
		this.link = null
	}

	find = async (message: Pick<IMessage, "_id" | "createdAt">): Promise<MessageLink> => {
		const link = this.messages.chain.find(MessageLink.byId(message._id))
		if (link) {
			return this.set(link)
		} else {
			const timestamp = moment(message.createdAt).valueOf()
			await this.messages.surround(timestamp)
			return this.find(message)
		}
	}

	checkIsFinded(link: MessageLink) {
		return this.link === link
	}
}
