package router

import (
	"container/list"
	"context"
	"sync"
)

// byteBudget admits work against a fixed number of in-flight bytes. Waiters are served in arrival
// order, so a large request is not starved by a stream of small ones.
type byteBudget struct {
	mu      sync.Mutex
	size    int64
	used    int64
	waiters list.List // of *budgetWaiter
}

type budgetWaiter struct {
	n     int64
	ready chan struct{}
}

func newByteBudget(size int64) *byteBudget {
	return &byteBudget{size: size}
}

// acquire charges n bytes, waiting for room until ctx ends. A charge above the whole budget is
// clamped to it, so it is admitted alone instead of waiting forever. The returned release gives the
// charge back and is safe to call more than once.
func (b *byteBudget) acquire(ctx context.Context, n int64) (release func(), err error) {
	n = max(0, min(n, b.size))
	b.mu.Lock()
	if b.waiters.Len() == 0 && b.used+n <= b.size {
		b.used += n
		b.mu.Unlock()
		return b.releaser(n), nil
	}
	w := &budgetWaiter{n: n, ready: make(chan struct{})}
	elem := b.waiters.PushBack(w)
	b.mu.Unlock()

	select {
	case <-w.ready:
		return b.releaser(n), nil
	case <-ctx.Done():
		b.mu.Lock()
		select {
		case <-w.ready: // admitted at the same moment: hand the charge back
			b.used -= n
		default:
			b.waiters.Remove(elem)
		}
		b.admit()
		b.mu.Unlock()
		return nil, ctx.Err()
	}
}

func (b *byteBudget) releaser(n int64) func() {
	var once sync.Once
	return func() {
		once.Do(func() {
			b.mu.Lock()
			b.used -= n
			b.admit()
			b.mu.Unlock()
		})
	}
}

// admit wakes waiters from the front while they fit. The caller holds mu.
func (b *byteBudget) admit() {
	for e := b.waiters.Front(); e != nil; e = b.waiters.Front() {
		w := e.Value.(*budgetWaiter)
		if b.used+w.n > b.size {
			return
		}
		b.used += w.n
		b.waiters.Remove(e)
		close(w.ready)
	}
}
