import { makeAutoObservable } from "mobx"
import { IDocument } from "./types"

export default class FileIDocument implements IDocument {
	name: string
	size: string
	type: string
	uri: string

	base64?: string
	duration?: number

	constructor(readonly file: File) {
		makeAutoObservable(this, {}, { autoBind: true })

		this.name = file.name
		this.type = file.type
		this.size = file.size.toString()
		this.uri = URL.createObjectURL(file)
	}

	static list = (files: File[]) => files.map((file) => new FileIDocument(file))
}
