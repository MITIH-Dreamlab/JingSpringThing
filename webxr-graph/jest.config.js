// jest.config.js

export default {
    testEnvironment: 'jsdom',
    transform: {
      '^.+\\.js$': 'babel-jest'
    },
    moduleFileExtensions: ['js', 'json'],
    testPathIgnorePatterns: ['/node_modules/', '/public/'],
    moduleNameMapper: {
      '^three$': '<rootDir>/node_modules/three/build/three.module.js'
    }
  };
  