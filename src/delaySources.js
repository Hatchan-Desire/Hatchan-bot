// 監視対象の路線一覧。Yahoo!路線情報の路線別運行情報ページをソースにしている。
// 新しい路線を追加したい場合はここに { key, label, url } を追加するだけでよい。
const LINE_SOURCES = [
  {
    key: 'meitetsu-nagoya',
    label: '名鉄名古屋本線',
    url: 'https://transit.yahoo.co.jp/diainfo/208/0',
  },
  {
    key: 'jr-tokaido',
    label: 'JR東海道本線（豊橋～米原）',
    url: 'https://transit.yahoo.co.jp/diainfo/192/193',
  },
];

module.exports = { LINE_SOURCES };
