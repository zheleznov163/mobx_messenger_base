import { IConversation } from "./types"
import { getRandomInRange } from "utils"
import Message from "../Message/Message"

export default class MembersColor {
	private data: {
		[key in string]: number
	} = {}

	constructor({ members }: IConversation, private count = 7) {
		members.forEach(({ _id }) => this.addMemberID(_id))
	}

	/**
	 * возвращает число, ассоциировнное с цветом
	 */
	check(message: Message) {
		const id = message.sender._id
		const value = this.data[id]

		if (value) {
			return value
		}
		return this.addMemberID(id)
	}

	addMemberID(id: string) {
		const value = getRandomInRange(0, this.count)
		this.data[id] = value
		return value
	}
}
