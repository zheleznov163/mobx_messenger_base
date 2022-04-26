import { makeAutoObservable } from "mobx"
import Message from "../../Message"
import MessageLink from "./MessageLink"
import { IMessagesChain } from "./types"
import Chat from ".."

export default class MessagesChain implements IMessagesChain {
	chain: MessageLink[] = []

	constructor(public chat: Chat, messages: Message[] = []) {
		this.init(messages)
		makeAutoObservable(this, {}, { autoBind: true })
	}

	init(messages: Message[]) {
		this.chain = messages.reduce(this.factory, [] as MessageLink[])
	}

	update(messages: Message[]) {
		const { sending } = this.splited
		const links = messages.reduce(this.factory, [])
		const sendingsLinks = sending.reduce(this.factory, [])

		const firstSending = sendingsLinks[sendingsLinks.length - 1]
		const lastInit = links[0]

		lastInit?.setNext(firstSending)
		firstSending?.setPrev(lastInit)

		this.chain = [...sendingsLinks, ...links]

		return links
	}

	/** Первое(более старое) сообщение */
	get first() {
		return this.chain[this.chain.length - 1] ? this.chain[this.chain.length - 1] : null
	}
	/** Последнее(более новое) сообщение */
	get last() {
		return this.chain.length > 0 ? this.chain[0] : null
	}

	get splited() {
		return this.chain.reduce(MessagesChain.split, { sending: [], sync: [] })
	}

	/** Добавить следующее сообщение */
	add(message: Message) {
		const link = new MessageLink(this, message, this.last)
		this.last?.setNext(link)
		this.chain.unshift(link)
		return link
	}

	delete(link: MessageLink) {
		link.prev?.setNext(link.next)
		link.next?.setPrev(link.prev)
		this.chain = this.chain.filter(MessageLink.equal(link, false))
	}

	addNextMessages(messages: Message[]) {
		const links = messages.reduce(this.factory, [])
		this.addNextChain(links)
		return links
	}

	addPrevMessages(messages: Message[]) {
		this.addPrevChain(messages.reduce(this.factory, []))
	}

	private addPrevChain(links: MessageLink[]) {
		this.first?.setPrev(links[0])
		links[0]?.setNext(this.first)
		this.chain.push(...links)
	}

	private addNextChain(links: MessageLink[]) {
		this.last?.setNext(links[links.length - 1])
		links[links.length - 1]?.setPrev(this.last)
		this.chain.unshift(...links)
	}

	private factory = (chain: MessageLink[], message: Message, index: number) => {
		// Следующим сообщением по порядку является предыдущий элемент массива
		const next = chain[index - 1]
		// Создаем звено цепочки сообщений,
		// предыдущее сообщение на этом цикле не известно
		const link = new MessageLink(this, message, undefined, next)
		// устанавливаем текущее звено как предка звену из прошлого цикла
		next?.setPrev(link)
		// добавляем элемент в цепочку
		chain.push(link)
		// передаем цепочку в аккамулятор. Цепочка сообщений готова
		return chain
	}

	static split = (acc: { sending: Message[]; sync: Message[] }, link: MessageLink) => {
		const { message } = link
		if (message.sending) {
			acc.sending.push(message)
		} else {
			acc.sync.push(message)
		}
		return acc
	}
}
