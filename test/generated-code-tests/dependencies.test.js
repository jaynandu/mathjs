import assert from 'assert'
import { addDependencies, divideDependencies, piDependencies } from '../../src/entry/dependenciesAny.generated'
const { create } = require('../../src/core/create')

describe('dependencies', function () {
  it('should create functions from a collection of dependencies', () => {
    const { add, divide, pi } = create({
      addDependencies,
      divideDependencies,
      piDependencies
    })

    assert.strictEqual(add(2, 3), 5)
    assert.strictEqual(divide(6, 3), 2)
    assert.strictEqual(pi, Math.PI)
  })

  it('should create functions from with config', () => {
    const config = { number: 'BigNumber' }
    const { pi } = create({
      piDependencies
    }, config)

    assert.strictEqual(pi.isBigNumber, true)
    assert.strictEqual(pi.toString(), '3.141592653589793238462643383279502884197169399375105820974944592')
  })
})
