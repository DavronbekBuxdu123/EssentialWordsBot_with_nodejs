// Kitoblar
const array = [
  { name: "Essential Words 1 📗", data: "book1" },
  { name: "Essential Words 2 📕", data: "book2" },
  { name: "Essential Words 3 📘", data: "book3" },
  { name: "Essential Words 4 📙", data: "book4" },
  // { name: "Essential Words 5 📔", data: "book5" },
  // { name: "Essential Words 6 📚", data: "book6" },
];
const TestBooks = [];
array.map((book) =>
  TestBooks.push([{ text: book.name, callback_data: `${book.data}` }])
);

module.exports = TestBooks;
