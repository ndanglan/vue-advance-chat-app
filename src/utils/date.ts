import dayjs from 'dayjs';

// hàm đệm 0
export const zeroPad = (num: number, pad: number) => {
  return String(num).padStart(pad, '0');
};

export const parseTimestamp = (timestamp: string, format = '') => {
  if (!timestamp) return;

  const date = dayjs(timestamp);

  if (format) {
    return date.format(format);
  }

  return date.format('HH:mm');
};

export const formatTimestamp = (date: Date, timestamp: string) => {
  const today = dayjs();
  const inputDate = dayjs(date);
  const timestampFormat = today.isSame(inputDate) ? 'HH:mm' : 'DD/MM/YY';
  const result = parseTimestamp(timestamp, timestampFormat);

  return timestampFormat === 'HH:mm' ? `Today, ${result}` : result;
};
