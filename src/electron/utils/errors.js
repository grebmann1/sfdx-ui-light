const encodeError = (errors) => {
    // we only handle 1 error for now !! (we could send an array, that's not a problem !)
    let e = [].concat(errors)[0];
    let res = {name: e.name, message: e.message};
    console.error({...e});
    return res;
}

module.exports = {encodeError};