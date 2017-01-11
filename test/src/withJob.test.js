/* @flow */

import React from 'react';
import { mount } from 'enzyme';
import { Foo, resolveAfter, rejectAfter, warningsAsErrors } from '../helpers';
import { withJob } from '../../src';

const workTime = 10; // ms

describe('withJob()', () => {
  warningsAsErrors();

  describe('arguments', () => {
    it('returns a function', () => {
      const actual = typeof withJob(() => undefined);
      const expected = 'function';
      expect(actual).toEqual(expected);
    });

    it('should throws if no work is provided', () => {
      // $FlowIgnore: we expect this to flow error
      expect(() => withJob())
        .toThrowError('You must provide a "createWork" function to the "withJob".');
    });

    it('should throws if the work is invalid', () => {
      // $FlowIgnore: we expect this to flow error
      expect(() => withJob(1))
        .toThrowError('You must provide a "createWork" function to the "withJob".');
    });
  });

  describe('higher order component', () => {
    const hoc = withJob(() => resolveAfter(1));
    const Actual = hoc(Foo);

    it('should return a renderable component', () => {
      expect(() => mount(<Actual />)).not.toThrowError();
    });
  });

  describe('rendering', () => {
    it('should set the "result" immediately if the work does not return a promise', () => {
      const FooWithJob = withJob(() => 'bob')(Foo);
      expect(mount(<FooWithJob />)).toMatchSnapshot();
    });

    it('should provide the props to the work function', () => {
      const expected = { foo: 'bar', baz: 'qux' };
      let actual;
      const FooWithJob = withJob((props) => { actual = props; })(Foo);
      mount(<FooWithJob {...expected} />);
      expect(actual).toMatchObject(expected);
    });

    it('should set "inProgress" when processing work', () => {
      const FooWithJob = withJob(() => resolveAfter(workTime))(Foo);
      const actual = mount(<FooWithJob />).find(Foo).props();
      const expected = { job: { completed: false, inProgress: true } };
      expect(actual).toMatchObject(expected);
    });

    it('should set "result" when work completes successfully', () => {
      const FooWithJob = withJob(() => resolveAfter(workTime, 'result'))(Foo);
      const renderWrapper = mount(<FooWithJob />);
      // Allow enough time for work to complete
      return resolveAfter(workTime + 5)
        .then(() => {
          const actual = renderWrapper.find(Foo).props();
          const expected = { job: { completed: true, inProgress: false, result: 'result' } };
          expect(actual).toMatchObject(expected);
        })
        // swallow other errors
        .catch(() => undefined);
    });

    it('should set "error" when asynchronous work fails', () => {
      const error = new Error('poop');
      const FooWithJob = withJob(() => rejectAfter(workTime, error))(Foo);
      const renderWrapper = mount(<FooWithJob />);
      // Allow enough time for work to complete
      return resolveAfter(workTime + 5)
        .then(() => {
          const actual = renderWrapper.find(Foo).props();
          const expected = { job: { completed: true, inProgress: false, error } };
          expect(actual).toMatchObject(expected);
        })
        // swallow other errors
        .catch(() => undefined);
    });

    it('should set "error" when synchronous work fails', () => {
      const error = new Error('poop');
      const FooWithJob = withJob(() => { throw error; })(Foo);
      const renderWrapper = mount(<FooWithJob />);
      const actual = renderWrapper.find(Foo).props();
      const expected = { job: { completed: true, inProgress: false, error } };
      expect(actual).toMatchObject(expected);
    });

    it('should not pass down internal props', () => {
      let actual = {};
      const Bob = (props) => {
        actual = props;
        return <div>bob</div>;
      };
      const BobWithJob = withJob(() => true)(Bob);
      const expected = { foo: 'foo', bar: 'bar' };
      mount(<BobWithJob {...expected} />);
      const actualProps = Object.keys(actual);
      expect(actualProps.length).toEqual(3);
      expect(actualProps).toContain('foo');
      expect(actualProps).toContain('bar');
      expect(actualProps).toContain('job');
    });

    it('should not fire work again when work is in progress', () => {
      let fireCount = 0;
      const Bob = () => <div>bob</div>;
      const BobWithJob = withJob(() => {
        fireCount += 1;
        return resolveAfter(20);
      })(Bob);
      const renderWrapper = mount(<BobWithJob />);
      expect(fireCount).toEqual(1);
      // Set props to cause a re-render
      renderWrapper.setProps({ foo: 'bar' });
      expect(fireCount).toEqual(1);
    });

    it('should not fire work again when work is complete', () => {
      let fireCount = 0;
      const Bob = () => <div>bob</div>;
      const BobWithJob = withJob(() => {
        fireCount += 1;
        return true;
      })(Bob);
      const renderWrapper = mount(<BobWithJob />);
      expect(fireCount).toEqual(1);
      // Set props to cause a re-render
      renderWrapper.setProps({ foo: 'bar' });
      expect(fireCount).toEqual(1);
    });

    it('should fire again for a remount', () => {
      let fireCount = 0;
      const Bob = () => <div>bob</div>;
      const BobWithJob = withJob(() => {
        fireCount += 1;
        return true;
      })(Bob);
      mount(<BobWithJob />);
      expect(fireCount).toEqual(1);
      mount(<BobWithJob />);
      expect(fireCount).toEqual(2);
    });
  });
});
