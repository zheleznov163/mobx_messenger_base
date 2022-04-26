import Attachment, { IAttachment } from "core/attachment"
import { getDeclension } from "utils"

type ISplitedAttachments = {
	[key in IAttachment["type"]]: IAttachment[]
}

export default class SplitedAttachments implements ISplitedAttachments {
	video: IAttachment[] = []
	image: IAttachment[] = []
	file: IAttachment[] = []
	sticker: IAttachment[] = []
	audio: IAttachment[] = []

	private get data(): ISplitedAttachments {
		return {
			video: this.video,
			image: this.image,
			file: this.file,
			sticker: this.sticker,
			audio: this.audio,
		}
	}

	get length() {
		return Object.entries<IAttachment[]>(this.data).map(
			([type, attachs]) => [type, attachs.length] as [IAttachment["type"], number],
		)
	}

	get discription() {
		const notNullableAttachTypes = this.length.filter(([_, length]) => !!length)
		switch (notNullableAttachTypes.length) {
			case 0:
				return ""
			case 1:
				return Attachment.getName(...notNullableAttachTypes[0])
			default:
				return `📎${notNullableAttachTypes.length} ${getDeclension(notNullableAttachTypes.length, [
					"вложение",
					"вложения",
					"вложений",
				])}`
		}
	}

	private static reducer = (acc: SplitedAttachments, attach: IAttachment) => {
		if (attach?.type) {
			acc[attach.type].push(attach)
		}
		return acc
	}

	static createBy(attachments: IAttachment[]) {
		return attachments.reduce(this.reducer, new SplitedAttachments())
	}
}
