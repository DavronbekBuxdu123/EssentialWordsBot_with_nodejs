// Kitoblar
const array = [
  { name: "Essential Words 1 📗", data: "word1" },
  { name: "Essential Words 2 📕", data: "word2" },
  { name: "Essential Words 3 📘", data: "word3" },
  { name: "Essential Words 4 📙", data: "word4" },
  { name: "Essential Words 5 📔", data: "word5" },
  // { name: "Essential Words 6 📚", data: "word6" },
];
const Books = [];
array.map((book) =>
  Books.push([{ text: book.name, callback_data: `${book.data}` }])
);

module.exports = Books;
