module.exports = {
    testEnvironment: 'node',
    transform: {
      '^.+\\.js$': 'babel-jest',
    },
    moduleFileExtensions: ['js', 'json'],
    testPathIgnorePatterns: ['/node_modules/', '/public/'],
  };
  