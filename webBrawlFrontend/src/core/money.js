//this function converts the given number to paise
export const toPaise = (number) => {
  return Math.round(number * 100);
};

export const formatINR = (paise) => {
  return `₹${(paise / 100).toFixed(2)}`;
};
