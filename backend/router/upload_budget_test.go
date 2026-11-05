package router

import (
	"context"
	"testing"
	"time"
)

func admitted(t *testing.T, ch <-chan func(), within time.Duration) (func(), bool) {
	t.Helper()
	select {
	case release := <-ch:
		return release, true
	case <-time.After(within):
		return nil, false
	}
}

func acquireAsync(b *byteBudget, ctx context.Context, n int64) <-chan func() {
	ch := make(chan func(), 1)
	go func() {
		if release, err := b.acquire(ctx, n); err == nil {
			ch <- release
		}
	}()
	return ch
}

func TestByteBudgetHoldsItsSize(t *testing.T) {
	b := newByteBudget(100)
	r1, err := b.acquire(context.Background(), 60)
	if err != nil {
		t.Fatal(err)
	}
	r2, err := b.acquire(context.Background(), 40)
	if err != nil {
		t.Fatal(err)
	}
	third := acquireAsync(b, context.Background(), 1)
	if _, ok := admitted(t, third, 100*time.Millisecond); ok {
		t.Fatal("admitted past the budget")
	}
	r1()
	r3, ok := admitted(t, third, 2*time.Second)
	if !ok {
		t.Fatal("not admitted after a release")
	}
	r2()
	r3()
	if b.used != 0 {
		t.Fatalf("used %d after every release", b.used)
	}
}

func TestByteBudgetServesWaitersInOrder(t *testing.T) {
	b := newByteBudget(100)
	hold, _ := b.acquire(context.Background(), 100)
	big := acquireAsync(b, context.Background(), 80)
	time.Sleep(50 * time.Millisecond)
	small := acquireAsync(b, context.Background(), 10) // would fit beside nothing, but big is first
	hold()
	releaseBig, ok := admitted(t, big, 2*time.Second)
	if !ok {
		t.Fatal("the first waiter was not admitted")
	}
	releaseSmall, ok := admitted(t, small, 2*time.Second)
	if !ok {
		t.Fatal("the second waiter (fits beside the first) was not admitted")
	}
	releaseBig()
	releaseSmall()
}

func TestByteBudgetReleaseIsIdempotent(t *testing.T) {
	b := newByteBudget(100)
	release, _ := b.acquire(context.Background(), 70)
	release()
	release()
	if b.used != 0 {
		t.Fatalf("used %d, want 0", b.used)
	}
}

func TestByteBudgetClampsAnOversizeCharge(t *testing.T) {
	b := newByteBudget(100)
	release, err := b.acquire(context.Background(), 5000)
	if err != nil {
		t.Fatal(err)
	}
	if b.used != 100 {
		t.Fatalf("used %d, want the whole budget", b.used)
	}
	release()
}

func TestByteBudgetCancelledWaiterLeavesTheQueue(t *testing.T) {
	b := newByteBudget(100)
	hold, _ := b.acquire(context.Background(), 90)
	ctx, cancel := context.WithCancel(context.Background())
	errc := make(chan error, 1)
	go func() {
		_, err := b.acquire(ctx, 50) // head of the queue, blocks the 5 behind it
		errc <- err
	}()
	time.Sleep(50 * time.Millisecond)
	behind := acquireAsync(b, context.Background(), 5)
	time.Sleep(50 * time.Millisecond)
	cancel()
	if err := <-errc; err == nil {
		t.Fatal("a cancelled wait returned no error")
	}
	releaseBehind, ok := admitted(t, behind, 2*time.Second)
	if !ok {
		t.Fatal("the waiter behind a cancelled one stayed blocked")
	}
	releaseBehind()
	hold()
	if b.used != 0 || b.waiters.Len() != 0 {
		t.Fatalf("used %d, %d waiters left", b.used, b.waiters.Len())
	}
}

func TestByteBudgetWaitEndsWithItsDeadline(t *testing.T) {
	b := newByteBudget(10)
	hold, _ := b.acquire(context.Background(), 10)
	defer hold()
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	if _, err := b.acquire(ctx, 1); err != context.DeadlineExceeded {
		t.Fatalf("err %v, want a deadline", err)
	}
}
