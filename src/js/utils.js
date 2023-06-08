
export function getRealValue(value, decimals) {
    let v = String(value);
    let d = Number(decimals);
    let i = v.indexOf(".");
    return i < 0 ? v + "0".repeat(d) :
            v.substring(0, i) + (v.length - i - 1 >= d ? v.substring(i + 1, i + 1 + d) : v.substring(i + 1) + "0".repeat(d - (v.length - i - 1)));
}

export function getShortAddress(address) {
    if (address && address.length > 14) {
        return address.substring(0, 6) + '...' + address.substring(address.length - 4);
    }
    return address;
}
