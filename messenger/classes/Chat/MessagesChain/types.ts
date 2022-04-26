import { Moment } from "moment"
import { UserBySearch } from "core/user"
import { MessageModel } from "../../Message/types"
import Chat from ".."

export interface IMessageLink {
	id: string
	message: MessageModel
	// ref: RefObject<HTMLDivElement> | null
	chainMessages: IMessagesChain
	member: UserBySearch | undefined
	prev: IMessageLink | null
	next: IMessageLink | null
	setPrev(link?: IMessageLink | null): void
	setNext(link?: IMessageLink | null): void
	isStart: boolean | undefined
	isFinish: boolean | undefined
	moment: Moment
	calendar: string
	date: string
	isFirst: boolean
	isSelf: boolean | undefined
	// scrollIntoView(): void
	// setRef(ref: RefObject<HTMLDivElement> | null): void

	startOfDay: IMessageLink | undefined
	startOfBlock: IMessageLink | undefined

	onScreen: boolean
	setOnScreen(onScreen: boolean): void

	isStartOfNewMessages: boolean
}

export interface IMessagesChain {
	chat: Chat
	chain: IMessageLink[]
	first: IMessageLink | null
	last: IMessageLink | null
	init(messages: any[]): void
	add(message: any): void
}
