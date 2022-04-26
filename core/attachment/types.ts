import Loader from "./Loader"

export interface IDocument {
	name: string
	size: string
	type: string
	uri: string
	duration?: number
	base64?: string
}

export interface IAttachment {
	_id: string
	type: "audio" | "video" | "image" | "file" | "sticker"
	filename: string
	link: string
	preview: string
	size: number
	height: number | null // размеры до 2 декабря 2020 года не известны
	width: number | null
	title: string | null
	mimeType: string
	private?: boolean
	description?: string

	oldId?: string
	ownerId?: string
	__v?: number
	createdAt?: string
	updatedAt?: string
	duration?: null | number
	owner?: string
}

export type IRequest = {
	loader: Loader
	start(): Promise<IAttachment>
	type: "image" | "video" | "audio" | "file"
}
