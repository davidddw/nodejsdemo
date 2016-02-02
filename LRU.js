/* 丢弃最近未使用的数据
 * 使用 id为0的bucket来存储数据
 */
var dataNode = function(data){
    this.data = data;
    this.next = null;
    this.pre = null;
    this.key = null;
}
dataNode.prototype.toString = function(){
    return "data:"+this.data;
}
var Bucket = function(node){
    this.head = node;
    this.tail = node;
    this.key;
    this.length=1;
}
Bucket.prototype.toString = function(){
    var str = '';
    var head = this.head
    while(head){
        str += head+'==>';
        head = head.next;
    }
    str += 'null';
    return str;
}
Bucket.prototype.unChain = function(node){
    //if (node.key != this.key){
    //    throw new Error('node is not in this Bucket');
    //}
    if (node.next){
        if (node.pre){
            node.next.pre = node.pre;
            node.pre.next = node.next;
        } else{
            node.next.pre = null;
            this.head = node.next;
        }
    } else{
        if (node.pre){
            node.pre.next = null;
            this.tail = node.pre;
        } else{
            this.head = null;
            this.tail = null;
        }
    }
    node.pre = null;
    node.next = null;
    this.length --;
    return this;
}
Bucket.prototype.append = function(node){
    if (this.tail){
        this.tail.next = node;
        node.pre = this.tail;
        this.tail = node;
    } else{
        this.head = node;
        this.tail = node;
    }
    node.next = null;

    this.length ++;
    return this;
}
var LRU = function(capacity){
    this.container = {};
    this.map = {};
    this.size = 0;
    this.capacity = capacity;
}
LRU.prototype.set = function(key, value){
    if (key in this.container){
        this.container[key].data = value;
    } else {
        var node = new dataNode(key);
        if (this.size == this.capacity){
            /*
            for (var i in this.map){
                if (this.map[i].length > 0){
                    break;
                }
            }
            */
            var i = 0;
            var head = this.map[i].head;
            this.map[i].unChain(head);
            delete (this.container[head.data]);
        } else{
            this.size ++;
        }
        if (0 in this.map){
            this.map[0].append(node);
        } else{
            this.map[0] = new Bucket(node);
        }
        this.container[key] = {data:value, ref:{bucketKey:0, node:node}};
    }

}
LRU.prototype.get = function(key){
    if (key in this.container){
        var ref = this.container[key].ref;
        this.map[ref.bucketKey].unChain(ref.node);
        if (this.map[ref.bucketKey].length == 0)
            delete(this.map[ref.bucketKey]);
        var newBucketKey = 0;//ref.bucketKey+1;
        if (newBucketKey in this.map){
            this.map[newBucketKey].append(ref.node);
        } else{
            this.map[newBucketKey] = new Bucket(ref.node);
        }
        this.container[key].ref.bucketKey = newBucketKey;
        return this.container[key].data;
    } else{
        return null;
    }
}

LRU.prototype.toString = function(){
    var str = 'LRU: capacity ' + this.capacity +'\n';
    str += 'map:\n'
    for (var i in this.map){
        str += i+': '+this.map[i]+'\n'
    }
    str += 'container:\n'
    for (i in this.container){
        var cur = this.container[i];
        str += i+': ' + cur.data +',[' + cur.ref.bucketKey + ',' + cur.ref.node + ']\n';
    }
    return str;
}


/**test**/
/*
var a = new dataNode(12);
var c = new dataNode(13);
console.log(a);
var b = new Bucket(a);
b.append(c);
console.log(b+'');
var t = new LRU(20);
console.log(new Date().getMilliseconds());
for(var i=0; i<38; i++){
    t.set(i%19, 1);
    t.get(i%19, 1)
    console.log(t.toString());
}
t.set(20,1);
t.get(20,1);
t.set(21,1);
t.get(21,1);
t.set(20,1);
t.get(20,1);
t.set(21,1);
t.get(21,1);
t.set(20,1);
t.get(20,1);
t.set(21,1);
t.get(21,1);
t.get(1,1);
    console.log(t.toString());

//console.log(t.toString());
console.log(new Date().getMilliseconds());

console.log('-------------');
*/
module.exports = LRU;

