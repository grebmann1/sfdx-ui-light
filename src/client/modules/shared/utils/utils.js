export function decodeError({name, message}){
    const e = new Error(message)
        e.name = name
    return e
}
